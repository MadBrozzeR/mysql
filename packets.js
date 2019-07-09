const Writer = require('./writer.js');
const Reader = require('./reader.js');
const CAP = require('./constants.js').CAP;
const CONST = require('./constants.js').CONST;
const FLAG = require('./constants.js').FLAG;
const PACKET = require('./constants.js').PACKET;
const TYPE = require('./constants.js').TYPE;
const COM = require('./constants.js').COM;
const capabilities = require('./capabilities.js');
const getDataByColumnType = require('./formatters.js').getDataByColumnType;
const stringify = require('./formatters.js').stringify;

function writeHandshakeResponse (params, session) {
  const base = params.base;
  const user = params.user;
  const method = params.method;
  const authData = params.authData;
  const commonCapabilities = params.serverCapabilities & (
    base ? (capabilities | CAP.CLIENT_CONNECT_WITH_DB) : capabilities
  );
  session.capabilities = commonCapabilities;
  let authLen = null;
  let authResponse;
  if (commonCapabilities & CAP.CLIENT_PLUGIN_AUTH_LENENC_CLIENT_DATA) {
    authLen = Writer.IntegerLenenc(authData.length);
    authResponse = Writer.Buffer(authData);
  } else if (commonCapabilities & CAP.CLIENT_SECURE_CONNECTION) {
    authLen = Writer.Integer(authData.length, 1);
    authText = Writer.Buffer(authData);
  } else {
    authResponse = [Writer.Buffer(authData), Writer.Fill()];
  }

  return [
    Writer.Integer(commonCapabilities, 4),
    Writer.Integer(session.options.maxPacketSize, 4),
    Writer.Integer(session.options.encoding, 1),
    Writer.Fill(0, 23),
    Writer.StringNull(user),
    authLen,
    authResponse,
    base ? Writer.StringNull(base) : null,
    Writer.StringNull(method)
  ];
}

function writeQueryRequest (command) {
  return [
    Writer.Integer(COM.QUERY),
    Writer.String(command)
  ];
}

function writePrepareRequest (command) {
  return [
    Writer.Integer(COM.STMT_PREPARE),
    Writer.String(command)
  ];
}

function writeExecuteRequest (statement, data = []) {
  const types = [];
  const values = [];
  const params = statement.model.params;
  const nullBitmapLength = Math.ceil(params.length / 8);
  const nullBitmap = !!nullBitmapLength && Buffer.alloc(nullBitmapLength, 0);
  let unsigned;

  for (let index = 0 ; index < params.length ; ++index) {
    unsigned = (params[index].flags & 0x80) << 8;
    types.push(Writer.Integer(params[index].type | unsigned, 2));
    const value = data[index];
    const param = params[index];

    if (value === null) {
      const nullByte = Math.floor(index / 8);
      const nullBit = index % 8;
      nullBitmap[nullByte] |= 1 << nullBit;
    } else {
      switch (param.type) {
        case TYPE.VARCHAR:
        case TYPE.VAR_STRING:
          values.push(Writer.StringLenenc(stringify(value)));
          break;
        case TYPE.TINY:
          values.push(Writer.Integer(value, 1));
          break;
        case TYPE.SHORT:
        case TYPE.YEAR:
          values.push(Writer.Integer(value, 2));
          break;
        case TYPE.LONG:
        case TYPE.INT24:
          values.push(Writer.Integer(value, 4));
          break;
        case TYPE.LONGLONG:
          values.push(writer.Integer(value, 8));
          break;
        default:
          values.push(Writer.StringLenenc(stringify(value)));
          break;
      }
    }
  }

  return [
    Writer.Integer(COM.STMT_EXECUTE),
    Writer.Integer(statement.model.id, 4),
    Writer.Fill(0),
    Writer.Integer(1, 4),
    nullBitmap && Writer.Buffer(nullBitmap),
    Writer.Integer(values.length ? 1 : 0, 1),
    types,
    values
  ];
}

function readHandshakePayload (buffer) {
  let reader = new Reader(buffer);

  let result = {
    protocolVersion: reader.readUIntLE(1),
    serverVersion: reader.readStrNull(),
    connectionId: reader.readUIntLE(4)
  };

  if (result.protocolVersion === 10) {
    result.auth = {
      data: reader.slice(8)
    };
    result.capabilities = reader.skip(1).readUIntLE(2);
    if (!reader.endReached()) {
      result.charset = reader.readUIntLE(1);
      result.statusFlags = reader.readUIntLE(2);
      result.capabilities = (result.capabilities | reader.readUIntLE(2) << 16) >>> 0;
      const authPluginDataLength = reader.readUIntLE(1);
      reader.skip(10); // Reserved 00 x10 next.
      const nextMove = Math.max(authPluginDataLength - 8, 13);
      result.auth.data = Buffer.concat([result.auth.data, reader.slice(nextMove)], nextMove + 8);
      result.auth.name = reader.readStrNull(CONST.ASCII);
    }
  } else {
    // Protocol version 9
    result.auth = {
      data: reader.readStrNull()
    };
  }
  return result;
}

function readPackets (buffer) {
  const reader = new Reader(buffer);
  const packets = [];
  let packet;
  let length;

  while (!reader.isEndReached()) {
    packet = {
      length: reader.readUIntLE(3),
      sid: reader.readUIntLE(1)
    };
    packet.payload = reader.slice(packet.length);
    packets.push(packet);
  }

  return packets;
}

function readAuthMoreData (payload) {
  let result = null;

  if (payload[0] === PACKET.AUTH_MORE_DATA) {
    const reader = new Reader(buffer);
    result = {
      type: reader.readUIntLE(1),
      data: reader.readStrEof()
    };
  }

  return result;
}

function readErrorPacket (payload, session) {
  let result = null;

  if (payload[0] === PACKET.ERROR) {
    let reader = new Reader(payload);
    result = {
      type: reader.readUIntLE(1),
      code: reader.readInt(2)
    };
    if (session.capabilities & CAP.CLIENT_PROTOCOL_41) {
      result.sqlStateMarker = reader.read(1);
      result.sqlState = reader.read(5);
    }
    result.message = reader.readStrEof();
  }
  return result;
}

function readOkPacket (payload, session) {
  let result = null;

  if (payload[0] === PACKET.OK || payload[0] === PACKET.EOF) {
    let reader = new Reader(payload);
    result = {
      type: reader.readUIntLE(1),
      affectedRows: reader.readIntLenenc(),
      lastInsertId: reader.readIntLenenc()
    };
    if (session.capabilities & CAP.CLIENT_PROTOCOL_41) {
      result.flags = reader.readUIntLE(2);
      result.warningCount = reader.readUIntLE(2);
    } else if (session.capabilities & CAP.CLIENT_TRANSACTIONS) {
      result.flags = reader.readUIntLE(2);
    }
    if (session.capabilities & CAP.CLIENT_SESSION_TRACK) {
      result.info = reader.readStrLenenc();
      if (result.flags & FLAG.SERVER_SESSION_STATE_CHANGED) {
        result.stateChangeInfo = reader.readStrLenenc();
      }
    } else {
      result.info = reader.readStrEof();
    }
  }

  return result;
}

function readEofPacket (payload, session) {
  let result = null;

  if (payload[0] === PACKET.EOF) {
    let reader = new Reader(payload);
    result = {
      type: reader.readUIntLE(1)
    };
    if (session.capabilities & CAP.CLIENT_PROTOCOL_41) {
      result.warnings = reader.readUIntLE(2);
      result.flags = reader.readUIntLE(2);
    }
  }

  return result;
}

function readLocalInfileResponse (payload) {
  let result = null;

  if (payload[0] === PACKET.LOCAL_INFILE) {
    const reader = new Reader(payload);
    result = {
      type: reader.readUIntLE(1),
      file: reader.readStrEof()
    };
  }

  return result;
}

function readColumnCount (payload) {
  const reader = new Reader(payload);

  return reader.readIntLenenc();
}

function readColumnDefinition (payload, session) {
  const reader = new Reader(payload);

  let result;
  if (session.capabilities & CAP.CLIENT_PROTOCOL_41) {
    result = {
      catalog: reader.readStrLenenc(),
      schema: reader.readStrLenenc(),
      table: reader.readStrLenenc(),
      orgTable: reader.readStrLenenc(),
      name: reader.readStrLenenc(),
      orgName: reader.readStrLenenc(),
      lengthOfFLFields: reader.readIntLenenc(),
      charset: reader.readUIntLE(2),
      length: reader.readUIntLE(4),
      type: reader.readUIntLE(1),
      flags: reader.readUIntLE(2),
      decimals: reader.readUIntLE(1)
    };
    reader.skip(2);
  } else {
    result = {
      table: reader.readStrLenenc(),
      name: reader.readStrLenenc()
    };
    const lengthOfColumnLength = reader.readIntLenenc();
    result.length = reader.readUIntLE(lengthOfColumnLength);
    const lengthOfTypeField = reader.readIntLenenc();
    result.type = reader.readUIntLE(lengthOfTypeField);

    reader.skip(1);
    result.flags = (session.capabilities & CAP.CLIENT_LONG_FLAG)
      ? reader.readUIntLE(2)
      : reader.readUIntLE(1);
    result.decimals = reader.readUIntLE(1);
  }
  if (!reader.isEndReached()) {
    result.defaultValues = reader.readStrLenenc();
  }

  return result;
}

function readResultPacket (payload, session) {
  return readErrorPacket(payload, session)
    || (!(session.capabilities & CAP.CLIENT_DEPRICATE_EOF) && readEofPacket(payload, session))
    || readOkPacket(payload, session);
}

function Resultset (columns) {
  this.columns = columns;
  this.data = [];
  this.end = null;
  this.index = 0;
}
Resultset.prototype.getRow = function (index) {
  if (index !== undefined) {
    this.index = index;
  }
  const data = this.data[this.index];
  let row = null;
  if (data) {
    row = (data[0] === 0x00) ? this.getBinaryRow(this.index) : this.getRawRow(this.index);
    ++this.index;
  }

  return row;
}
Resultset.prototype.getRawRow = function (index) {
  const reader = new Reader(this.data[index]);
  const row = {};
  const keepBuffer = {keepBuffer: true};

  for (let index = 0 ; index < this.columns.length ; ++index) {
    const isNull = reader.buffer[reader.index] === 0xfb;
    const data = isNull ? (reader.skip(1) && null) : reader.readStrLenenc(keepBuffer);
    const column = this.columns[index];

    row[column.name] = data && getDataByColumnType(data, column);
  }

  return row;
}
Resultset.prototype.getBinaryRow = function (index) {
  const reader = new Reader(this.data[index]);
  const header = reader.readUIntLE(1);
  const nullBitmapLength = Math.ceil((this.columns.length + 2) / 8);
    let nullBitmap = reader.slice(nullBitmapLength);
    const keepBuffer = {keepBuffer: true};
  const row = {};
  let data;

  for (let index = 0 ; index < this.columns.length ; ++index) {
    const nullByte = Math.floor((index + 2) / 8);
    const nullBit = (index + 2) % 8;
    if (nullBitmap[nullByte] & 1 << nullBit) {
      data = null;
    } else {
      switch (this.columns[index].type) {
        case TYPE.LONGLONG:
          data = parseInt(reader.readUIntLE(8), 10);
          break;
        case TYPE.LONG:
          data = parseInt(reader.readUIntLE(4), 10);
          break;
        case TYPE.SHORT:
          data = parseInt(reader.readUIntLE(2), 10);
          break;
        case TYPE.TINY:
          data = parseInt(reader.readUIntLE(1), 10);
          break;
        case TYPE.DOUBLE:
          data = reader.read(8);
          break;
        case TYPE.FLOAT:
          data = reader.read(4);
          break;
        default:
          data = getDataByColumnType(reader.readStrLenenc(keepBuffer), this.columns[index]);
          break;
      }
    }
    row[this.columns[index].name] = data;
  }

  return row;
}

function readResultset (packets, session) {
  const columnCount = readColumnCount(packets[0].payload);
  let current = 0;
  const lastRowIndex = packets.length - 2;
  const columns = [];

  for (let index = 0 ; index < columnCount ; ++index) {
    columns.push(readColumnDefinition(packets[++current].payload, session));
  }
  const result = new Resultset(columns);

  if (!(session.capabilities & CAP.CLIENT_DEPRICATE_EOF)) {
    ++current;
  }
  while (current < lastRowIndex) {
    result.data.push(packets[++current].payload);
  }
  result.end = readResultPacket(packets[++current].payload, session);

  return result;
}

function readStmtPrepareOkHead (payload) {
  let result = null;

  if (payload[0] === PACKET.OK) {
    const reader = new Reader(payload);
    result = {
      type: reader.readUIntLE(1),
      id: reader.readUIntLE(4),
      numColumns: reader.readUIntLE(2),
      numParams: reader.readUIntLE(2),
      warnings: reader.skip(1).readUIntLE(2)
    };
  }

  return result;
}

function readStmtPrepareOk (packets, session) {
  const head = readStmtPrepareOkHead(packets[0].payload);
  let result = null;
  let packetIndex = 1;

  if (head) {
    result = {
      type: head.type,
      id: head.id,
      params: [],
      columns: []
    };

    for (let index = 0 ; index < head.numParams ; ++index) {
      result.params.push(readColumnDefinition(packets[packetIndex++].payload, session));
    }
    packets[packetIndex] && (packets[packetIndex].payload[0] === PACKET.EOF) && (++packetIndex);
    for (let index = 0 ; index < head.numColumns ; ++index) {
      result.columns.push(readColumnDefinition(packets[packetIndex++].payload, session));
    }
  }

  return result;
}

module.exports = {
  writeHandshakeResponse,
  writeQueryRequest,
  writePrepareRequest,
  writeExecuteRequest,

  readHandshakePayload,
  readAuthMoreData,
  readEofPacket,
  readErrorPacket,
  readOkPacket,
  readLocalInfileResponse,
  readResultset,
  readStmtPrepareOk,
  readResultPacket,
  readPackets
};

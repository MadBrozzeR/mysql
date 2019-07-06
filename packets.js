const Writer = require('./writer.js');
const Reader = require('./reader.js');
const CAP = require('./constants.js').CAP;
const CONST = require('./constants.js').CONST;
const FLAG = require('./constants.js').FLAG;
const PACKET = require('./constants.js').PACKET;
const TYPE = require('./constants.js').TYPE;
const capabilities = require('./capabilities.js');
const getDataByColumnType = require('./formatters.js').getDataByColumnType;

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
      failure: true,
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
      ok: true,
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
      type: reader.readUIntLE(1),
      ok: true
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
  let row = null;
  if (this.data[this.index]) {
    const reader = new Reader(this.data[this.index]);
    row = {};
    const keepBuffer = {keepBuffer: true};

    for (let index = 0 ; index < this.columns.length ; ++index) {
      const isNull = reader.buffer[reader.index] === 0xfb;
      const data = isNull ? (reader.skip(1) && null) : reader.readStrLenenc(keepBuffer);
      const column = this.columns[index];

      row[column.name] = data && getDataByColumnType(data, column);
    }
  }
  ++this.index;

  return row;
}

function readResultset (packets, session) {
  const columnCount = readColumnCount(packets[0].payload);
  let packetCursor = 0;
  const lastRowIndex = packets.length - 2;
  const columns = [];

  for (let index = 0 ; index < columnCount ; ++index) {
    columns.push(readColumnDefinition(packets[++packetCursor].payload, session));
  }
  const result = new Resultset(columns);

  if (!(session.capabilities & CAP.CLIENT_DEPRICATE_EOF)) {
    ++packetCursor;
  }
  while (packetCursor < lastRowIndex) {
    result.data.push(packets[++packetCursor].payload);
  }
  result.end = readResultPacket(packets[++packetCursor].payload, session);

  return result;
}

module.exports = {
  writeHandshakeResponse,
  readHandshakePayload,
  readAuthMoreData,
  readEofPacket,
  readErrorPacket,
  readOkPacket,
  readLocalInfileResponse,
  readResultset,
  readResultPacket,
  readPackets
};

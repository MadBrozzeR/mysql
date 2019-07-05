const Writer = require('./writer.js');
const Reader = require('./reader.js');
const CAP = require('./constants.js').CAP;
const CONST = require('./constants.js').CONST;
const FLAG = require('./constants.js').FLAG;
const capabilities = require('./capabilities.js');

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

function readAuthMoreData (buffer) {
  if (buffer[0] !== 1) {
    return null;
  }

  const reader = new Reader(buffer);

  return {
    type: reader.readUIntLE(1),
    data: reader.readStrEof()
  };
}

function readErrorPacket (payload, session) {
  let result = null;

  if (payload[0] === 0xff) {
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

  if (payload[0] === 0x00 || payload[0] === 0xfe) {
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

  if (payload[0] === 0xfe) {
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

module.exports = {
  writeHandshakeResponse,
  readHandshakePayload,
  readAuthMoreData,
  readEofPacket,
  readErrorPacket,
  readOkPacket,
  readPackets
};

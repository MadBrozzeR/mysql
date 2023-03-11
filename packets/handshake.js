const Writer = require('../writer.js');
const Reader = require('../reader.js');
const CAP = require('../constants.js').CAP;
const CONST = require('../constants.js').CONST;
const PACKET = require('../constants.js').PACKET;
const capabilities = require('../capabilities.js');

module.exports.readAuthMoreData = function readAuthMoreData (payload) {
  let result = null;

  if (payload[0] === PACKET.AUTH_MORE_DATA) {
    const reader = new Reader(buffer);
    result = {
      type: reader.readUIntLE(1),
      data: reader.readStrEof()
    };
  }

  return result;
};

module.exports.writeHandshakeResponse = function writeHandshakeResponse (params, session) {
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
    authLen = Writer.IntegerLenenc(authData.length).is('Auth data length');
    authResponse = Writer.Buffer(authData).is('Auth data');
  } else if (commonCapabilities & CAP.CLIENT_SECURE_CONNECTION) {
    authLen = Writer.Integer(authData.length, 1).is('Auth data length');
    authResponse = Writer.Buffer(authData).is('Auth data');
  } else {
    authResponse = [Writer.Buffer(authData).is('Auth data'), Writer.Fill()];
  }

  return [
    Writer.Integer(commonCapabilities, 4).is('Capabilities'),
    Writer.Integer(session.options.maxPacketSize, 4).is('Max packet size'),
    Writer.Integer(session.options.encoding, 1).is('Encoding'),
    Writer.Fill(0, 23).is('Reserved bytes'),
    Writer.StringNull(user).is('User name'),
    authLen && authLen,
    authResponse && authResponse,
    base ? Writer.StringNull(base).is('Database') : null,
    Writer.StringNull(method).is('Auth plugin')
  ];
};

module.exports.readHandshakePayload = function readHandshakePayload (buffer) {
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
};

module.exports.readAuthSwitchRequest = function readAuthSwitchRequest (payload) {
  let result = null;

  if (payload[0] === PACKET.AUTH_SWITCH) {
    const reader = new Reader(payload);

    result = {
      type: reader.readUIntLE(1),
      plugin: reader.readStrNull(),
      data: reader.readEof()
    };
  }

  return result;
};

module.exports.writeAuthSwitchResponse = function writeAuthSwitchResponse (data) {
  return [Writer.Buffer(data).is('Auth switch response')];
}

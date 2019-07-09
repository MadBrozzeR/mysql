const handshake = require('./handshake.js');
const query = require('./query.js');
const common = require('./common.js');
const resultset = require('./resultset.js');
const statement = require('./statement.js');

module.exports = {
  writeHandshakeResponse: handshake.writeHandshakeResponse,
  writeQueryRequest: query.writeQueryRequest,
  writePrepareRequest: statement.writePrepareRequest,
  writeExecuteRequest: statement.writeExecuteRequest,

  readAuthMoreData: handshake.readAuthMoreData,
  readHandshakePayload: handshake.readHandshakePayload,
  readResultset: resultset.readResultset,
  readStmtPrepareOk: statement.readStmtPrepareOk,
  readEofPacket: common.readEofPacket,
  readErrorPacket: common.readErrorPacket,
  readOkPacket: common.readOkPacket,
  readLocalInfileResponse: common.readLocalInfileResponse,
  readResultPacket: common.readResultPacket,
  readPackets: common.readPackets
};

const Reader = require('../reader.js');
const Writer = require('../writer.js');
const PACKET = require('../constants.js').PACKET;
const CAP = require('../constants.js').CAP;
const FLAG = require('../constants.js').FLAG;

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
    packet.complete = packet.payload.length === packet.length;
    packets.push(packet);
  }

  return packets;
};

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
};

function readResultPacket (payload, session) {
  return readErrorPacket(payload, session)
    || (!(session.capabilities & CAP.CLIENT_DEPRICATE_EOF) && readEofPacket(payload, session))
    || readOkPacket(payload, session);
};

function writePacket (sid, data) {
  const payload = Writer.Group(data);
  return [
    Writer.SizeOf(payload, 3, { unsigned: true, littleEndian: true }).is('Payload size'),
    Writer.Integer(sid % 0xff, 1).is('SID'),
    payload
  ];
}

module.exports = {
  readErrorPacket: readErrorPacket,
  readOkPacket: readOkPacket,
  readEofPacket: readEofPacket,
  readPackets: readPackets,
  readLocalInfileResponse: readLocalInfileResponse,
  readResultPacket: readResultPacket,
  writePacket: writePacket,
};

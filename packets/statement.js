const Writer = require('../writer.js');
const Reader = require('../reader.js');
const COM = require('../constants.js').COM;
const TYPE = require('../constants.js').TYPE;
const PACKET = require('../constants.js').PACKET;
const stringify = require('../formatters.js').stringify;
const readColumnDefinition = require('./resultset.js').readColumnDefinition;

module.exports.writePrepareRequest = function writePrepareRequest (command) {
  return [
    Writer.Integer(COM.STMT_PREPARE),
    Writer.String(command)
  ];
};

const emptyBuffer = Buffer.from('');

const MAX_SIZE = 1024 * 1024 * 3;
const MIN_SIZE = 1024;

function writeSplitBySize (buffer, params) {
  const statementId = params.statementId;
  const paramIndex = params.paramInndex;
  const longData = params.longData;
  const values = params.values;

  if (buffer.length < MIN_SIZE) {
    values.push(Writer.StringLenenc(buffer));
  } else {
    let index = 0;
    let last;

    while (index < buffer.length) {
      last = index + MAX_SIZE;
      if (last >= buffer.length) {
        last = undefined;
      }
      longData.push(writeLongData(statementId, paramIndex, buffer.slice(index, last)));
      index += MAX_SIZE;
    }
    values.push(Writer.Buffer(emptyBuffer));
  }
}

module.exports.writeExecuteRequest = function writeExecuteRequest (statement, data = []) {
  const types = [];
  const values = [];
  const params = statement.model.params;
  const nullBitmapLength = Math.ceil(params.length / 8);
  const nullBitmap = !!nullBitmapLength && Buffer.alloc(nullBitmapLength, 0);
  let unsigned;
  const longData = [];

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
          values.push(Writer.Integer(value, 8));
          break;
        case TYPE.TINY_BLOB:
        case TYPE.MEDIUM_BLOB:
        case TYPE.BLOB:
        case TYPE.LONG_BLOB:
        case TYPE.VARCHAR:
        case TYPE.VAR_STRING:
          writeSplitBySize(value, {
            statementId: statement.model.id,
            paramIndex: index,
            longData: longData,
            values: values
          });
          break;
        default:
          values.push(Writer.StringLenenc(stringify(value)));
          break;
      }
    }
  }

  return {
    longData: longData,
    command: [
      Writer.Integer(COM.STMT_EXECUTE),
      Writer.Integer(statement.model.id, 4),
      Writer.Fill(0),
      Writer.Integer(1, 4),
      nullBitmap && Writer.Buffer(nullBitmap),
      Writer.Integer(values.length ? 1 : 0, 1),
      types,
      values
    ]
  };
};

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

module.exports.readStmtPrepareOk = function readStmtPrepareOk (packets, session) {
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
};

function writeLongData (statementId, paramIndex, data) {
  return [
    Writer.Integer(COM.STMT_SEND_LONG_DATA),
    Writer.Integer(statementId, 4),
    Writer.Integer(paramIndex, 2),
    Writer.Buffer(data)
  ];
}

module.exports.writeLongData = writeLongData;

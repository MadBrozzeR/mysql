const Reader = require('../reader.js');
const CAP = require('../constants.js').CAP;
const TYPE = require('../constants.js').TYPE;
const getDataByColumnType = require('../formatters.js').getDataByColumnType;
const getDateValue = require('../formatters.js').getDateValue;
const readResultPacket = require('./common.js').readResultPacket;

function readColumnCount (payload) {
  const reader = new Reader(payload);

  return reader.readIntLenenc();
};

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
};

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
          data = reader.readDoubleLE();
          break;
        case TYPE.FLOAT:
          data = reader.readFloatLE();
          break;
        case TYPE.DATE:
        case TYPE.DATETIME:
        case TYPE.TIMESTAMP:
          data = getDateValue(reader.readStrLenenc(keepBuffer));
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
Resultset.prototype.getAllRows = function () {
  const result = [];
  let row;

  while (row = this.getRow()) {
    result.push(row);
  }

  return result;
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
};

module.exports = {
  readResultset: readResultset,
  readColumnDefinition: readColumnDefinition
};

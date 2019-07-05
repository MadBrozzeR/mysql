const Writer = require('mbr-buffer').Writer;

const MySQLWriter = {...Writer};

const INT_PARAMS = {unsigned: true, littleEndian: true};
const UTF_8 = 'utf8';

function getIntLenenc (value) {
  const result = {};

  if (value < 0xfc) {
    result.prefix = null;
    result.length = 1;
  } else if (value < 0x10000) {
    result.prefix = 0xfc;
    result.length = 3;
  } else if (value < 0x1000000) {
    result.prefix = 0xfd;
    result.length = 4;
  } else {
    result.prefix = 0xfe;
    result.length = 9;
  }

  return result;
}

function writeLenenc (buffer, prefix, length, value) {
  if (prefix) {
    buffer.writeUInt8(prefix, 0);
    buffer.writeUIntLE(value, 1, length - 1);
  } else {
    buffer.writeUInt8(value, 0);
  }
}

MySQLWriter.Integer = function (value, length) {
  return Writer.Integer(value, length, INT_PARAMS);
};

const IntegerLenencType = Writer.Element.extend(function IntegerLenencType (value) {
  Writer.Element.call(this, value, 0);
  this.recalculateLength();
}, function () {
  const buffer = Buffer.allocUnsafe(this.length);
  writeLenenc(buffer, this.prefix, this.length, this.value);

  return Writer.Element.prototype.valueOf.call(this, buffer);
});

IntegerLenencType.prototype.recalculateLength = function () {
  const lenenc = getIntLenenc(this.value);
  this.prefix = lenenc.prefix;
  this.length = lenenc.length;
};

const StringLenencType = Writer.Element.extend(function StringLenencType (value, length, params = {}) {
  Writer.Element.call(this, value, 0);
  this.strLength = length || Buffer.byteLength(value);
  this.encoding = params.encoding || UTF_8;
  this.recalculateLength();
}, function () {
  const buffer = Buffer.allocUnsafe(this.length);
  writeLenenc(buffer, this.intPrefix, this.intLength, this.strLength);
  if (this.value instanceof Buffer) {
    this.value.copy(buffer, this.intLength, 0);
  } else {
    buffer.write(this.value, this.intLength, this.strLength, this.encoding);
  }

  return Writer.Element.prototype.valueOf.call(this, buffer);
});

StringLenencType.prototype.recalculateLength = function () {
  const lenenc = getIntLenenc(this.strLength);
  this.intPrefix = lenenc.prefix;
  this.intLength = lenenc.length;
  this.length = this.strLength + lenenc.length;
};

const StringNullType = Writer.Element.extend(function StringNullType (value, length, params = {}) {
  Writer.Element.call(this, value, (length || Buffer.byteLength(value)) + 1);
  this.encoding = params.encoding || UTF_8;
}, function () {
  const buffer = Buffer.allocUnsafe(this.length);
  buffer.write(this.value, 0, this.length - 1, this.encoding);
  buffer.writeInt8(0, this.length - 1);

  return Writer.Element.prototype.valueOf.call(this, buffer);
});

MySQLWriter.IntegerLenenc = IntegerLenencType.generator();
MySQLWriter.StringLenenc = StringLenencType.generator();
MySQLWriter.StringNull = StringNullType.generator();

module.exports = MySQLWriter;

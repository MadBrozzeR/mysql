const Reader = require('mbr-buffer').Reader;

function MySQLReader (buffer, BE) {
  Reader.call(this, buffer);
  this.BE = BE;
}
MySQLReader.prototype = Object.create(Reader.prototype);
MySQLReader.prototype.constructor = MySQLReader;

Reader.prototype.endReached = function () {
  return this.index >= this.buffer.length;
}

MySQLReader.prototype.readIntLenenc = function () {
  let result = this.readUIntLE();

  switch (result) {
    case 0xfe:
      result = this.BE ? this.readUIntBE(8) : this.readUIntLE(8);
      break;
    case 0xfd:
      result = this.BE ? this.readUIntBE(3) : this.readUIntLE(3);
      break;
    case 0xfc:
      result = this.BE ? this.readUIntBE(2) : this.readUIntLE(2);
      break;
  }
  return result;
}

MySQLReader.prototype.readStrLenenc = function (params = {}) {
  const len = this.readIntLenenc();
  return params.keepBuffer ? this.slice(len) : this.read(len);
}

MySQLReader.prototype.readStrNull = function (encoding) {
  const result = this.read(this.until(0), encoding);
  this.skip(1);
  return result;
}

MySQLReader.prototype.readEof = function () {
  const result = this.buffer.slice(this.index);
  this.index = this.buffer.length;

  return result;
}
MySQLReader.prototype.readStrEof = function () {
  return this.readEof().toString();
}

module.exports = MySQLReader;

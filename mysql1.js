const Connection = require('./connection.js');
const EMPTY = require('./constants.js').EMPTY;

function MySQL(options = {}) {
  this.options = {
    maxPacketSize: 0x1,
    encoding: 8,
    port: 3306,
    host: 'localhost'
  };
  if (options) {
    for (let option in options) {
      this.options[option] = options[option];
    }
  }
}

MySQL.prototype.connect = function (params = EMPTY) {
  return new Connection({
    user: params.user,
    pass: params.password,
    base: params.base,
    timeout: params.timeout || this.options.timeout,
    onSuccess: params.onSuccess,
    onError: params.onError,
    onClose: params.onClose,
    options: this.options,
  });
}

const mysql = new MySQL();
mysql.connect();

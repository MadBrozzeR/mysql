const Connection = require('./connection.js');
const EMPTY = require('./constants.js').EMPTY;

function MySQL(options = EMPTY) {
  this.options = {
    maxPacketSize: 0x10,
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
mysql.connect({
  user: 'madbrozzer',
  password: '123456',
  onError: function (error) {
    console.log('Connection failure:', error);
  },
  onSuccess: function (okPacket) {
    console.log('Connection success:', okPacket);
  }
}).query('use mysql', {
  onSuccess: function (packet) {
    console.log('Query success:', packet);
  },
  onError: function (error) {
    console.log('Query failure:', error);
  }
}).query('select * from user', {
  onSuccess: function (packet) {
    console.log('Query success:', packet);
    let row;
    while (row = packet.getRow()) {
      console.log(row);
    }
  },
  onError: function (error) {
    console.log('Query failure:', error);
  }
}).close();

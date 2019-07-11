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
  user: 'test1',
  password: '123456',
  base: 'test',
  onError: function (error) {
    console.log('Connection failure:', error);
  },
  onSuccess: function (okPacket) {
    console.log('Connection success:', okPacket);
  }
/* }).query('use mysql', {
  onSuccess: function (packet) {
    console.log('Query success:', packet);
  },
  onError: function (error) {
    console.log('Query failure:', error);
  }
}).query('select host,user,authentication_string,max_connections from user', {
  onSuccess: function (packet) {
    console.log('Query success:');
    let row;
    while (row = packet.getRow()) {
      console.log(row);
    }
  },
  onError: function (error) {
    console.log('Query failure:', error);
  }
*/ }).prepare('insert into data (`test`, `blob`) values (?, ?)', {
  onSuccess: function (result) {
    console.log('Prepare success:', result);
  },
  onError: function (error) {
    console.log('Prepare failure:', error);
  }
}).execute([Buffer.from('112233'), Buffer.from('1122334455667788')], {
  onSuccess: function (result) {
    console.log('Execute success:');
    let row;
    while (row = result.getRow()) {
      console.log(row);
    }
  },
  onError: function (error) {
    console.log('Execute failure:', error);
  }
}).session.close();

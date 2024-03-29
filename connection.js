const net = require('net');
const {EMPTY, CONST, CAP, COM, PACKET} = require('./constants.js');
const Queue = require('mbr-queue');
const Reader = require('./reader.js');
const Writer = require('./writer.js');
const Authentication = require('./auth.js');
const capabilities = require('./capabilities.js');
const Packets = require('./packets/index.js');
const operations = require('./operations/index.js');
const Packer = require('./packer.js');

function socketTimeout () {
  this.end();
}

function Connection (params = EMPTY) {
  const connection = this;

  this.options = params.options;

  this.socket = new net.Socket();
  this.queue = new Queue();
  this.packer = new Packer();

  this.queue.push(operations.handshake, {
    user: params.user,
    pass: params.pass,
    base: params.base,
    onSuccess: params.onSuccess,
    onError: params.onError,
    session: this
  });

  this.socket.on(CONST.DATA, function (data) {
    params.options.debug && console.log('server:', data);

    // console.log(connection.queue.queue[0].listeners.name, data.toString('hex'));
    connection.queue.trigger(CONST.COLLECT, data);
  });
  this.socket.on(CONST.TIMEOUT, socketTimeout);
  params.timeout && this.socket.setTimeout(params.timeout);
  params.onClose && this.socket.on(CONST.CLOSE, params.onClose);
  this.socket.on(CONST.ERROR, function (error) {
    connection.queue.trigger(CONST.ERROR, error);
  });
}

Connection.prototype.send = function (sid, data) {
  const result = Writer.make(Packets.writePacket(sid, data));
  // console.log(Writer.debug(Packets.writePacket(sid, data)));

  this.options.debug && console.log('client:', result);
  this.socket.write(result);
};

Connection.prototype.close = function (instant) {
  const socket = this.socket;
  if (instant || this.queue.isEmpty()) {
    socket.end();
  } else {
    this.queue.push(operations.close, {session: this});
  }

  return this;
};

Connection.prototype.query = function (data, params = EMPTY) {
  this.queue.push(operations.query, {
    session: this,
    sql: data,
    type: 'query',
    onSuccess: params.onSuccess,
    onError: params.onError
  });

  return this;
};

function Statement (command, session) {
  this.command = command;
  this.model = null;
  this.session = session;
}

Connection.prototype.prepare = function (command, params = EMPTY) {
  const statement = new Statement(command, this);

  this.queue.push(operations.prepare, {
    sql: command,
    session: this,
    statement: statement,
    type: 'prepare_statement',
    onSuccess: params.onSuccess,
    onError: params.onError
  });

  return statement;
};

Statement.prototype.execute = function (statementParams, params = EMPTY) {
  this.session.queue.push(operations.execute, {
    session: this.session,
    sql: this.command,
    statement: this,
    params: statementParams,
    type: 'execute_statement',
    onSuccess: params.onSuccess,
    onError: params.onError
  });

  return this;
}

Statement.prototype.sendLongData = function (paramIndex, data, params = EMPTY) {
  this.session.queue.push(operations.sendLongData, {
    session: this.session,
    sql: this.command,
    statement: this,
    paramIndex: paramIndex,
    data: data,
    type: 'send_long_data',
    chunkSize: params.chunkSize,
    onError: params.onError
  });

  return this;
};

module.exports = Connection;

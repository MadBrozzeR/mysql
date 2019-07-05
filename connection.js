const net = require('net');
const {EMPTY, CONST, CAP} = require('./constants.js');
const Queue = require('./queue.js');
const Reader = require('./reader.js');
const Writer = require('./writer.js');
const Authentication = require('./auth.js');
const capabilities = require('./capabilities.js');
const Packets = require('./packets.js');

function SQLError (params) {
  params.sql && (this.sql = params.sql);
  params.params && (this.params = params.params);
  this.code = params.code;
  this.message = params.message;
}
SQLError.prototype.failure = true;

function handshakeResponse (handshake, callback) {
  console.log(11111, this);
  const user = this.params.user;
  const pass = this.params.pass || '';
  const base = this.params.base;
  const session = this.params.session;

  const auth = Authentication(handshake.auth, pass, function (data) {
    data && callback && callback(Packets.writeHandshakeResponse({
      serverCapabilities: handshake.capabilities,
      user: user,
      base: base,
      authData: data,
      method: handshake.auth.name
    }, session));
  });
}

const operations = {
  handshake: {
    data: function (packets) {
      const _this = this;
      const packet = packets[0];
      const session = this.params.session;
      this.params.sid = packet.sid;

      switch (this.params.phase) {
        case 'INIT':
          const handshake = Packets.readHandshakePayload(packet.payload);
          handshakeResponse.call(this, handshake, function (response) {
            _this.params.phase = 'CHECK';
            session.send(++_this.params.sid, response);
          });
          break;
        case 'CHECK':
          const result = Packets.readAuthMoreData(packet.payload)
            || Packets.readErrorPacket(packet.payload, session)
            || Packets.readOkPacket(packet.payload, session);
          switch (result.type) {
            case 0xff:
              this.queue.trigger(CONST.ERROR, result);
              break;
            case 0xfe:
            case 0x00:
              this.params.onSuccess && this.params.onSuccess(result);
              this.queue.next();
              break;
          }
          break;
      }
    },
    error: function (error) {
      this.params.onError && this.params.onError(new SQLError(error));
    }
  },
  close: {
    init: function () {
      this.queue.clear();
      this.queue.next();
      this.params.session.close();
    }
  }
}

function socketTimeout () {
  this.end();
}

function Connection (params = EMPTY) {
  const _this = this;

  this.options = params.options;

  this.socket = new net.Socket();
  params.timeout && this.socket.setTimeout(params.timeout);
  this.queue = new Queue();
  const handshake = this.queue.push(operations.handshake, {
    phase: 'INIT',
    user: params.user,
    pass: params.pass,
    base: params.base,
    onSuccess: params.onSuccess,
    onError: params.onError,
    session: this
  });

  this.socket.on(CONST.DATA, function (data) {
    // console.log('server:', data);
    _this.queue.trigger(CONST.DATA, Packets.readPackets(data));
  });
  this.socket.on(CONST.TIMEOUT, socketTimeout);
  params.onClose && this.socket.on(CONST.CLOSE, params.onClose);
  this.socket.on(CONST.ERROR, function (error) {
    _this.queue.trigger(CONST.ERROR, error);
  });

  this.socket.connect(this.options.port, this.options.host);
}

Connection.prototype.send = function (sid, data) {
  const payload = Writer.Group(data);
  const result = Writer.make([
    Writer.SizeOf(payload, 3, { unsigned: true, littleEndian: true }),
    Writer.Integer(sid, 1),
    payload
  ]);

  // console.log('client:', result.valueOf());
  this.socket.write(result);
}

Connection.prototype.close = function (instant) {
  const socket = this.socket;
  if (instant || this.queue.isEmpty()) {
    socket.end();
  } else {
    const operation = this.queue.push(operations.close, {session: this});
  }
};

module.exports = Connection;

const net = require('net');
const crypto = require('crypto');
const {EMPTY, CONST, AUTH, CAP} = require('./constants.js');
const Queue = require('./queue.js');
const Reader = require('./reader.js');
const Writer = require('./writer.js');

function getHandshakePayload(buffer) {
  let reader = new Reader(buffer);

  let result = {
    protocolVersion: reader.readUIntLE(1),
    serverVersion: reader.readStrNull(),
    connectionId: reader.readUIntLE(4)
  };

  if (result.protocolVersion === 10) {
    result.auth = {
      data: reader.slice(8)
    };
    result.capabilities = reader.skip(1).readUIntLE(2);
    if (!reader.endReached()) {
      result.charset = reader.readUIntLE(1);
      result.statusFlags = reader.readUIntLE(2);
      result.capabilities = (result.capabilities | reader.readUIntLE(2) << 16) >>> 0;
      const authPluginDataLength = reader.readUIntLE(1);
      reader.skip(10); // Reserved 00 x10 next.
      const nextMove = Math.max(authPluginDataLength - 8, 13);
      result.auth.data = Buffer.concat([result.auth.data, reader.slice(nextMove)], nextMove + 8);
      result.auth.name = reader.readStrNull(CONST.ASCII);
    }
  } else {
    // Protocol version 9
    result.auth = {
      data: reader.readStrNull()
    };
  }
  return result;
}

function getPackets (buffer) {
  const reader = new Reader(buffer);
  const packets = [];
  let packet;
  let length;

  while (!reader.isEndReached()) {
    packet = {
      length: reader.readUIntLE(3),
      id: reader.readUIntLE(1)
    };
    packet.payload = reader.slice(packet.length);
    packets.push(packet);
  }

  return packets;
}

const Authentication = {};
Authentication[AUTH.MYSQL_NATIVE_PASSWORD] = function (params, callback) {
  let challenge = params.authData;
  const password = params.pass;

  if (challenge[challenge.length - 1] === 0x0) {
    challenge = challenge.slice(0, challenge.length - 1);
  }

  const passHash1 = crypto.createHash(CONST.SHA1);
  const passHash2 = crypto.createHash(CONST.SHA1);
  const rightHand = crypto.createHash(CONST.SHA1);
  let hashedPass;
  passHash1.on(CONST.READABLE, function () {
    hashedPass = passHash1.read();
    hashedPass && passHash2.end(hashedPass);
  });
  passHash2.on(CONST.READABLE, function () {
    const data = passHash2.read();
    data && rightHand.end(Buffer.concat([challenge, data]));
  });
  rightHand.on(CONST.READABLE, function () {
    const data = rightHand.read();
    data && callback && callback(bufferXor(hashedPass, data));
  });
  passHash1.end(password);
};

const myCapabilities =
  CAP.CLIENT_PROTOCOL_41 |
  CAP.CLIENT_SECURE_CONNECTION |
  CAP.CLIENT_PLUGIN_AUTH |
  CAP.CLIENT_DEPRICATE_EOF;

function getCapabilities (serverCapabilities) {
  return serverCapabilities & myCapabilities;
}

function handshakeResponse (handshake, callback) {
  const user = this.params.user;
  const pass = this.params.pass || '';
  const base = this.params.base;
  const session = this.session;

  console.log(handshake);
  const auth = Authentication[handshake.auth.name];

  auth && auth({
    authData: handshake.auth.data, 
    pass: Buffer.from(pass)
  }, function (data) {
    callback && callback([
      Writer.Integer(handshake.capabilities, 4),
      Writer.Integer(session.options.maxPacketSize, 4),
      Writer.Integer(session.options.encoding, 1),
      Writer.Integer(0, 23),
      Writer.StringNull(user),
      Writer.StringLenenc(data),
      Writer.StringNull(handshake.auth.name)
    ]);
  });
}

const operations = {
  handshake: {
    action: function () {
      this.phase = 0;
    },
    listeners: {
      data: function (buffer) {
        const _this = this;
        const packets = getPackets(buffer);
        const packet = packets[0];
        this.sid = packets[packets.length - 1].sid;
        switch (this.phase) {
          case 0:
            const handshake = getHandshakePayload(packet.payload);
            handshakeResponse.call(this, handshake, function (response) {
              _this.phase++;
              _this.session.capabilities = data.capabilities;
              _this.session.send(++_this.sid, response);
            });
            break;
          case 1:
            /*
            const packetData = getPacketData(packet.payload);
            this.session.done(this, packetData);
            */
            console.log(packet.payload);
            break;
        }
      },
      error: function (error) {
        console.log('Handshake failed with error.');
        console.log(error);
      }
    }
  }
}

function socketTimeout () {
  this.end();
}

function Connection (params = EMPTY) {
  const _this = this;

  this.options = params.options;
  this.terminate = false;

  this.socket = new net.Socket();
  params.timeout && this.socket.setTimeout(params.timeout);
  this.queue = new Queue();
  const handshake = this.queue.push(operations.handshake.action, operations.handshake.listeners);
  handshake.params = {
    phase: 0,
    user: params.user,
    pass: params.pass,
    base: params.base,
    onSuccess: params.onSuccess,
    onError: params.onError,
    session: this
  };

  this.socket.on(CONST.DATA, function (data) {
    _this.queue.trigger(CONST.DATA, data);
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

  this.socket.write(result);
}

module.exports = Connection;

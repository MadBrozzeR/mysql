const handleError = require('./common.js').handleError;
const handleSuccess = require('./common.js').handleSuccess;
const Authentication = require('../auth.js');
const Packets = require('../packets/index.js');
const PACKET = require('../constants.js').PACKET;
const CONST = require('../constants.js').CONST;

const PHASE = {
  INIT: 'INIT',
  CHECK: 'CHECK'
};

function handshakeResponse (handshake, callback) {
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

module.exports = {
  error: handleError,
  success: handleSuccess,
  init: function () {
    this.params.phase = PHASE.INIT;
  },
  data: function (packets) {
    const operation = this;
    const packet = packets[0];
    const session = this.params.session;
    this.params.sid = packet.sid;

    switch (this.params.phase) {
      case PHASE.INIT:
        const handshake = Packets.readHandshakePayload(packet.payload);
        handshakeResponse.call(this, handshake, function (response) {
          operation.params.phase = PHASE.CHECK;
          session.send(++operation.params.sid, response);
        });
        break;
      case PHASE.CHECK:
        const result = Packets.readAuthMoreData(packet.payload)
          || Packets.readResultPacket(packet.payload, session);
        switch (result.type) {
          case PACKET.ERROR:
            this.queue.trigger(CONST.ERROR, result);
            break;
          case PACKET.EOF:
          case PACKET.OK:
            this.queue.trigger(CONST.SUCCESS, result);
            break;
        }
        break;
    }
  }
};

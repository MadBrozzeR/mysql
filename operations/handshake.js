const { handleError, handleSuccess, collect } = require('./common.js');
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
  name: 'handshake',

  error: handleError,
  success: handleSuccess,
  init: function () {
    const session = this.params.session;
    this.params.phase = PHASE.INIT;

    session.socket.connect(session.options.port, session.options.host);
  },
  collect: collect,
  data: function (packets) {
    try {
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
            || Packets.readAuthSwitchRequest(packet.payload)
            || Packets.readResultPacket(packet.payload, session);

          switch (result.type) {
            case PACKET.ERROR:
              this.queue.trigger(CONST.ERROR, result);
              break;
            case PACKET.AUTH_SWITCH:
              Authentication({ name: result.plugin, data: result.data }, this.params.pass || '', function (data) {
                data && session.send(
                  ++operation.params.sid,
                  Packets.writeAuthSwitchResponse(data)
                );
              });
              break;
            case PACKET.OK:
              this.queue.trigger(CONST.SUCCESS, result);
              break;
          }
          break;
      }
    } catch (error) {
      this.queue.trigger(CONST.ERROR, error);
    }
  }
};

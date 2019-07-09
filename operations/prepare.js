const handleError = require('./common.js').handleError;
const handleSuccess = require('./common.js').handleSuccess;
const Packets = require('../packets.js');
const PACKET = require('../constants.js').PACKET;
const CONST = require('../constants.js').CONST;

module.exports = {
  init: function () {
    this.params.session.send(0, Packets.writePrepareRequest(this.params.statement.command));
  },
  error: handleError,
  success: function (result) {
    this.params.statement.model = result;
    handleSuccess.call(this, result);
  },
  data: function (packets) {
    const session = this.params.session;
    let result = Packets.readErrorPacket(packets[0].payload, session)
      || Packets.readStmtPrepareOk(packets, session);

    if (result) {
      switch (result.type) {
        case PACKET.ERROR:
          this.queue.trigger(CONST.ERROR, result);
          break;
        case PACKET.OK:
          this.queue.trigger(CONST.SUCCESS, result);
          break;
      }
    }
  }
};

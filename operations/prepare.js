const handleError = require('./common.js').handleError;
const handleSuccess = require('./common.js').handleSuccess;
const Packets = require('../packets/index.js');
const PACKET = require('../constants.js').PACKET;
const CONST = require('../constants.js').CONST;

module.exports = {
  init: function () {
    try {
      this.params.session.send(0, Packets.writePrepareRequest(this.params.statement.command));
    } catch (error) {
      this.queue.trigger(CONST.ERROR, error);
    }
  },
  error: handleError,
  success: function (result) {
    this.params.statement.model = result;
    handleSuccess.call(this, result);
  },
  data: function (packets) {
    try {
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
    } catch (error) {
      this.queue.trigger(CONST.ERROR, error);
    }
  }
};

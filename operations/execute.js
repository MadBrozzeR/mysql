const handleError = require('./common.js').handleError;
const handleSuccess = require('./common.js').handleSuccess;
const Packets = require('../packets.js');
const PACKET = require('../constants.js').PACKET;
const CONST = require('../constants.js').CONST;

module.exports = {
  init: function () {
    this.params.session.send(0, Packets.writeExecuteRequest(this.params.statement, this.params.params));
  },
  error: handleError,
  success: handleSuccess,
  data: function (packets) {
    const session = this.params.session;
    let result = Packets.readErrorPacket(packets[0].payload, session)
      || Packets.readOkPacket(packets[0].payload, session);

    if (result) {
      switch (result.type) {
        case PACKET.ERROR:
          this.queue.trigger(CONST.ERROR, result);
          break;
        case PACKET.SUCCESS:
          this.queue.trigger(CONST.SUCCESS, result);
          break;
      }
    } else {
      console.log(packets);
      result = Packets.readResultset(packets, session);
      this.queue.trigger(CONST.SUCCESS, result);
    }
  }
};

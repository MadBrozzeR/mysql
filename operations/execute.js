const { handleError, handleSuccess, collect } = require('./common.js');
const Packets = require('../packets/index.js');
const PACKET = require('../constants.js').PACKET;
const CONST = require('../constants.js').CONST;

module.exports = {
  name: 'execute',

  init: function () {
    try {
      const preparedRequest = Packets.writeExecuteRequest(this.params.statement, this.params.params);
      this.params.session.send(0, preparedRequest);
    } catch (error) {
      this.queue.trigger(CONST.ERROR, error);
    }
  },
  error: handleError,
  success: handleSuccess,
  collect: function (data) {
    const session = this.params.session;
    const { packer } = session;

    const packets = packer.push(data);

    if (packets) {
      let status = Packets.readErrorPacket(packets[0].payload, session)
        || Packets.readOkPacket(packets[0].payload, session);

      if (status) {
        packer.clear();
        this.queue.trigger(CONST.DATA, status);
        return;
      }

      status = Packets.readEofPacket(packets[packets.length - 1].payload, session);

      if (status) {
        packer.clear();
        const result = Packets.readResultset(packets, session);
        this.queue.trigger(CONST.DATA, result);
      }
    }
  },
  data: function (result) {
    try {
      const session = this.params.session;

      switch (result.type) {
        case PACKET.ERROR:
          this.queue.trigger(CONST.ERROR, result);
          break;
        default:
          this.queue.trigger(CONST.SUCCESS, result);
          break;
      }
    } catch (error) {
      this.queue.trigger(CONST.ERROR, error);
    }
  }
};

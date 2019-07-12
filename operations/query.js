const handleError = require('./common.js').handleError;
const handleSuccess = require('./common.js').handleSuccess;
const Packets = require('../packets/index.js');
const PACKET = require('../constants.js').PACKET;
const CONST = require('../constants.js').CONST;

module.exports = {
  init: function () {
    try {
      this.params.session.send(0, Packets.writeQueryRequest(this.params.sql));
    } catch (error) {
      this.queue.trigger(CONST.ERROR, error);
    }
  },
  error: handleError,
  success: handleSuccess,
  data: function (packets) {
    try {
      const session = this.params.session;
      let result = Packets.readResultPacket(packets[0].payload, session)
        || Packets.readLocalInfileResponse(packets[0].payload);

      if (result) {
        switch (result.type) {
          case PACKET.ERROR:
            this.queue.trigger(CONST.ERROR, result);
            break;
          case PACKET.OK:
          case PACKET.EOF:
          case PACKET.LOCAL_INFILE:
            this.queue.trigger(CONST.SUCCESS, result);
            break;
        }
      } else {
        result = Packets.readResultset(packets, session);
        this.queue.trigger(CONST.SUCCESS, result);
      }
    } catch (error) {
      this.queue.trigger(CONST.ERROR, error);
    }
  }
};

const handleError = require('./common.js').handleError;
const handleSuccess = require('./common.js').handleSuccess;
const Packets = require('../packets/index.js');
const PACKET = require('../constants.js').PACKET;
const CONST = require('../constants.js').CONST;

module.exports = {
  init: function () {
    const preparedRequest = Packets.writeExecuteRequest(this.params.statement, this.params.params);
    /*
    let args = [0];
    for (let index = 0 ; index < preparedRequest.longData.length ; ++index) {
      args.push(preparedRequest.longData[index]);
    }
    args.push(preparedRequest.command);
    this.params.session.send.apply(this.params.session, args);
    */
    for (let index = 0 ; index < preparedRequest.longData.length ; ++index) {
      this.params.session.send(0, preparedRequest.longData[index]);
    }
    this.params.session.send(0, preparedRequest.command);
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
        case PACKET.OK:
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

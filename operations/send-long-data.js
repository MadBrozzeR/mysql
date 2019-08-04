const Packets = require('../packets/index.js');
const CONST = require('../constants.js').CONST;
const common = require('./common.js');

module.exports = {
  error: common.handleError,
  init: function () {
    try {
      const session = this.params.session;
      const statement = this.params.statement.model;
      const chunkSize = this.params.chunkSize;
      const paramIndex = this.params.paramIndex;
      const data = this.params.data;

      if (chunkSize) {
        let index = 0;
        let nextIndex = 0;
        while (index < data.length) {
          nextIndex += chunkSize;
          if (nextIndex > data.length) {
            nextIndex = data.length;
          }
          session.send(0, Packets.writeLongData(statement.id, paramIndex, data.slice(index, nextIndex)));
          index = nextIndex;
        }
      } else {
        session.send(0, Packets.writeLongData(statement.id, this.params.paramIndex, data));
      }
      this.queue.next();
    } catch (error) {
      this.queue.trigger(CONST.ERROR, error);
    }
  }
}

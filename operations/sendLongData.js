const Packect = require('../packets/index.js');
const CONST = require('../constants.js');

module.exports = {
  init: function () {
    try {
      const session = this.params.session;
      const statement = this.params.statement.model;
      const chunkSize = this.params.chunkSize;
      const paramIndex = this.params.paramIndex;
      const data = this.params.data;

      if (chunkSize) {
        let index = 0;
        let nextIndex;
        while (index < data.length) {
          nextIndex += chunckSize;
          if (nextIndex >= data.length) {
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

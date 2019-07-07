module.exports = {
  init: function () {
    this.queue.clear();
    this.queue.next();
    this.params.session.close();
  }
};

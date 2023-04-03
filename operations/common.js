const { CONST } = require('../constants.js');

function SQLError (params) {
  this.sql = null;
  this.params = null;
  this.code = params.code;
  this.message = params.message;
  params.stack && (this.stack = params.stack.split('\n'));
}
SQLError.prototype.failure = true;

function handleError (error) {
  const sqlError = new SQLError(error);
  this.params.sql && (sqlError.sql = this.params.sql);
  this.params.params && (sqlError.params = this.params.params);

  this.queue.clear();
  this.queue.next();
  this.params.onError && this.params.onError(sqlError);
}

function handleSuccess (result) {
  this.params.onSuccess && this.params.onSuccess(result);
  this.queue.next();
}

function collect (data) {
  const { packer } = this.params.session;

  const packets = packer.push(data);

  if (packets) {
    packer.clear();
    this.queue.trigger(CONST.DATA, packets);
  }
}

module.exports = {
  handleError: handleError,
  handleSuccess: handleSuccess,
  collect: collect,
};

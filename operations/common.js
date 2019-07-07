function SQLError (params) {
  params.sql && (this.sql = params.sql);
  params.params && (this.params = params.params);
  this.code = params.code;
  this.message = params.message;
}
SQLError.prototype.failure = true;

function handleError (error) {
  this.params.onError && this.params.onError(new SQLError(error));
}

function handleSuccess (result) {
  this.params.onSuccess && this.params.onSuccess(result);
  this.queue.next();
}

module.exports = {
  handleError: handleError,
  handleSuccess: handleSuccess
};

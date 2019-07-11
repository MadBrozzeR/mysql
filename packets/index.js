[
  require('./handshake.js'),
  require('./query.js'),
  require('./common.js'),
  require('./resultset.js'),
  require('./statement.js')
].forEach(function (imported) {
  for (let method in imported) {
    module.exports[method] = imported[method];
  }
});

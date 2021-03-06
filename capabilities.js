const CAP = require('./constants.js').CAP;

module.exports = CAP.CLIENT_LONG_PASSWORD
  | CAP.CLIENT_FOUND_ROWS
  | CAP.CLIENT_LONG_FLAG
  | CAP.CLIENT_NO_SCHEMA
  | CAP.CLIENT_IGNORE_SPACE
  | CAP.CLIENT_PROTOCOL_41
  | CAP.CLIENT_TRANSACTIONS
  | CAP.CLIENT_MULTI_STATEMENTS
  | CAP.CLIENT_MULTI_RESULTS
  | CAP.CLIENT_PS_MULTI_RESULTS
  | CAP.CLIENT_PLUGIN_AUTH
  | CAP.CLIENT_PLUGIN_AUTH_LENENC_CLIENT_DATA
  | CAP.CLIENT_DEPRICATE_EOF;

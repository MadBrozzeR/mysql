const Writer = require('../writer.js');
const COM = require('../constants.js').COM;

module.exports.writeQueryRequest = function writeQueryRequest (command) {
  return [
    Writer.Integer(COM.QUERY).is('Command byte'),
    Writer.String(command).is('SQL query')
  ];
}


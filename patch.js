const { dateToString } = require('./formatters.js');
const { template } = require('./utils.js');

function patchDate (sql, date) {
  if (date instanceof Date) {
    return template(sql, { date: '\'' + dateToString(date) + '\'' });
  }

  if (date === null) {
    return template(sql, { date: 'NULL' })
  }

  return sql;
}

module.exports = { patchDate };

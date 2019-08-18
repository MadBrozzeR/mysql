const TYPE = require('./constants.js').TYPE;
const Reader = require('./reader.js');
const utils = require('./utils.js');

function getDateValue (date) {
  if (!date) {
    return null;
  }
  const reader = new Reader(date);
  let dateFields = {
    year: 0,
    month: 0,
    day: 1,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0
  };

  if (date.length >= 4) {
    dateFields.year = reader.readInt(2);
    dateFields.month = reader.readInt(1) - 1;
    dateFields.day = reader.readInt(1);
    if (date.length >= 7) {
      dateFields.hours = reader.readInt(1);
      dateFields.minutes = reader.readInt(1);
      dateFields.seconds = reader.readInt(1);
      if (date.length === 11) {
        dateFields.milliseconds = reader.readInt(4) / 1000;
      }
    }
  }
  return new Date(
    dateFields.year,
    dateFields.month,
    dateFields.day,
    dateFields.hours,
    dateFields.minutes,
    dateFields.seconds,
    dateFields.milliseconds
  );
}

function getDataByColumnType (data, column) {
  switch (column.type) {
    case TYPE.TINY:
    case TYPE.INT24:
    case TYPE.SHORT:
    case TYPE.LONG:
    case TYPE.LONGLONG:
      data = parseInt(data.toString(), 10);
      break;
    case TYPE.DECIMAL:
    case TYPE.FLOAT:
    case TYPE.DOUBLE:
      data = parseFloat(data.toString());
      break;
    case TYPE.BLOB:
    case TYPE.TINY_BLOB:
    case TYPE.MEDIUM_BLOB:
    case TYPE.LONG_BLOB:
      // keep buffer.
      break;
    case TYPE.NULL:
      data = null;
      break;
    case TYPE.DATETIME:
    case TYPE.DATE:
    case TYPE.TIMESTAMP:
      data = getDateValue(data);
      break
    default:
      data = data && data.toString();
      break;
  }
  return data;
}

function dateToString (date) {
  const template = '${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}';
  const data = {
    DD: utils.zeroLead(date.getDate()),
    MM: utils.zeroLead(date.getMonth() + 1),
    YYYY: date.getFullYear(),
    hh: utils.zeroLead(date.getHours()),
    mm: utils.zeroLead(date.getMinutes()),
    ss: utils.zeroLead(date.getSeconds())
  };

  return utils.template(template, data);
}

function stringify (value) {
  let result = '';

  if (value || value === 0) {
    if (value instanceof Date) {
      result = dateToString(value);
    } else {
      result = value.toString();
    }
  }
  return result;
}

module.exports = {
  getDataByColumnType,
  stringify
};

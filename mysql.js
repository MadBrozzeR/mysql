const net = require('net');
const crypto = require('crypto');
const fs = require('fs');

const Reader = require('./reader.js');
const Writer = require('./writer.js');
const utils = require('./utils.js');

const empty = {};

const CONST = {
  DATA: 'data',
  END: 'end',
  ERROR: 'error',
  CLOSE: 'close',
  TIMEOUT: 'timeout',
  ASCII: 'ascii',
  SHA1: 'sha1',
  READABLE: 'readable',
  ERROR_TPL: 'ERROR ${code}: ${sql}\n${message}\nParams: ${params}'
};

const RE = {
  DATETIME: /^(?:(\d{4})-(\d\d)-(\d\d))?\s?(?:(\d\d):(\d\d):(\d\d))?$/
};

const AUTH = {
  MYSQL_NATIVE_PASSWORD: 'mysql_native_password'
};

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

function dataDump (data, file) {
  file || (file = 'data.dump');

  fs.appendFile(__dirname + '/' + file, data.toString('hex') + '\n\n', function (error) {
    if (error) console.log(error);
  });
}

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

function stringify (value) {
  result = '';
  if (value) {
    if (value instanceof Date) {
      result = dateToString(value);
    } else {
      result = value.toString();
    }
  }
  return result;
}

const CAP = {
  // Use the improved version of Old Password Authentication.
  // Assumed to be set since 4.1.1.
  CLIENT_LONG_PASSWORD: 0x1,
  // Send 'found rows' instead of 'affected rows' in EOF_Packet.
  CLIENT_FOUND_ROWS: 0x2,
  // Longer flags in Protocol::ColumnDefinition320
  // Server supports longer flags.
  // Client expects longer flags.
  CLIENT_LONG_FLAG: 0x4,
  // Database (schema) name can be specified on connect in Handshake Response Packet.
  // Server supports schema-name in Handshake Response Packet.
  // Client Handshake Response Packet contains a schema-name.
  CLIENT_CONNECT_WITH_DB: 0x8,
  // Server does not permit database.table.column.
  CLIENT_NO_SCHEMA: 0x10,
  // Compression protocol supported.
  // Server supports compression.
  // Client switches to `Compression` compressed protocol after successfull authentication.
  CLIENT_COMPRESS: 0x20,
  // Special handling of ODBC behavior.
  // No special behavior since 3.22.
  CLIENT_ODBC: 0x40,
  // Can use LOAD DATA LOCAL.
  // Server enables the LOCAL INFILE request of LOAD DATA|XML.
  // Client will handle LOCAL INFILE request.
  CLIENT_LOCAL_FILES: 0x80,
  // Server parser can ignore spaces before '('.
  // Client let the parser ignore spaces before '('.
  CLIENT_IGNORE_SPACE: 0x100,
  // Server support the 4.1 protocol.
  // Client uses the 4.1 protocol.
  CLIENT_PROTOCOL_41: 0x200,
  // `wait_timeout` versus `wait_interactive_timeout`.
  // Server supports interactive and noninteractive clients.
  // Client is interactive.
  CLIENT_INTERACTIVE: 0x400,
  // Server supports SSL.
  // Client switch to SSL after sending the capability-flags.
  CLIENT_SSL: 0x800,
  // Client do not issue `sigpipe` if network failures occur (libmysqlclient only).
  CLIENT_IGNORE_SIGPIPE: 0x1000,
  // Server can send status flags in EOF_Packet.
  // Client expects status flags in EOF_Packet.
  CLIENT_TRANSACTIONS: 0x2000,
  // Unused.
  // Was named CLIENT_PROTOCOL_41 in 4.1.0.
  CLIENT_RESERVED: 0x4000,
  // Server supports Authentication::Native41.
  // Client supports Authentication::Native41.
  CLIENT_SECURE_CONNECTION: 0x8000,
  // Server can handle multiple statements per COM_QUERY and COM_STMT_PREPARE.
  // Client may send multiple statements per COM_QUERY and COM_STMT_PREPARE.
  // Requires CLIENT_PROTOCOL_41
  CLIENT_MULTI_STATEMENTS: 0x10000,
  // Server can send multiple resultsets for COM_QUERY.
  // Client can handle multiple resultsets for COM_QUERY.
  CLIENT_MULTI_RESULTS: 0x20000,
  // Server can send multiple resultsets for COM_STMT_EXECUTE.
  // Client can handle multiple resultsets for COM_STMT_EXECUTE.
  CLIENT_PS_MULTI_RESULTS: 0x40000,
  // Server sends extra data in Initial Handshake Packet
  //   and supports the pluggable authentication protocol.
  // Client supports authentication plugins.
  // Requires CLIENT_PROTOCOL_41.
  CLIENT_PLUGIN_AUTH: 0x80000,
  // Server permits connection attributes in Protocol::HandshakeResponse41.
  // Client sends connection attributes in Protocol::HandshakeResponse41.
  CLIENT_CONNECT_ATTRS: 0x100000,
  // Server understands length-encoded integer for auth response data in Protocol::HandshakeResponse41
  // Client: length of auth response data in Protocol::HandshakeResponse41 is a length-encoded integer.
  CLIENT_PLUGIN_AUTH_LENENC_CLIENT_DATA: 0x200000,
  // Server announces support for `expired password extension`.
  // Client can handle `expired passwords`.
  CLIENT_CAN_HANDLE_EXPIRED_PASSWORDS: 0x400000,
  // Server can set SERVER_SESSION_STATE_CHANGED in the status-flags
  //   and send `session-state change data` after an OK_Packet.
  // Client expects the server to send session-state changes after an OK_Packet.
  CLIENT_SESSION_TRACK: 0x800000,
  // Server can send OK after a Text Resultset.
  // Client expects an OK (instead of EOF) after the resultset rows of a Text Resultset.
  CLIENT_DEPRICATE_EOF: 0x1000000
};

const COM = {
  SLEEP: 0x00,
  QUIT: 0x01,
  INIT_DB: 0x02,
  QUERY: 0x03,
  FIELD_LIST: 0x04,
  CREATE_DB: 0x05,
  DROP_DB: 0x06,
  REFRESH: 0x07,
  SHUTDOWN: 0x08,
  STATISTICS: 0x09,
  PROCESS_INFO: 0x0a,
  CONNECT: 0x0b,
  PROCESS_KILL: 0x0c,
  DEBUG: 0x0d,
  PING: 0x0e,
  TIME: 0x0f,
  DELAYED_INSERT: 0x10,
  CHANGE_USER: 0x11,
  BINLOG_DUMP: 0x12,
  TABLE_DUMP: 0x13,
  CONNECT_OUT: 0x14,
  REGISTER_SLAVE: 0x15,
  STMT_PREPARE: 0x16,
  STMT_EXECUTE: 0x17,
  STMT_SEND_LONG_DATA: 0x18,
  STMT_CLOSE: 0x19,
  STMT_RESET: 0x1a,
  SET_OPTION: 0x1b,
  STMT_FETCH: 0x1c,
  DAEMON: 0x1d,
  BINLOG_DUMP_GTID: 0x1e,
  RESET_CONNECTION: 0x1f
};

const FLAG = {
  SERVER_STATUS_IN_TRANS: 0x0001,
  SERVER_STATUS_AUTOCOMMIT: 0x0002,
  SERVER_MORE_RESULTS_EXISTS: 0x0008,
  SERVER_STATUS_NO_GOOD_INDEX_USED: 0x0010,
  SERVER_STATUS_NO_INDEX_USED: 0x0020,
  SERVER_STATUS_CURSOR_EXISTS: 0x0040,
  SERVER_STATUS_LAST_ROW_SENT: 0x0080,
  SERVER_STATUS_DB_DROPPED: 0x0100,
  SERVER_STATUS_NO_BACKSLASH_ESCAPES: 0x0200,
  SERVER_STATUS_METADATA_CHANGED: 0x0400,
  SERVER_QUERY_WAS_SLOW: 0x0800,
  SERVER_PS_OUT_PARAMS: 0x1000,
  SERVER_STATUS_IN_TRANS_READONLY: 0x2000,
  SERVER_SESSION_STATE_CHANGED: 0x4000
};

const TYPE = {
  DECIMAL: 0x00,
  TINY: 0x01,
  SHORT: 0x02,
  LONG: 0x03,
  FLOAT: 0x04,
  DOUBLE: 0x05,
  NULL: 0x06,
  TIMESTAMP: 0x07,
  LONGLONG: 0x08,
  INT24: 0x09,
  DATE: 0x0a,
  TIME: 0x0b,
  DATETIME: 0x0c,
  YEAR: 0x0d,
  NEWDATE: 0x0e,
  VARCHAR: 0x0f,
  BIT: 0x10,
  TIMESTAMP2: 0x11,
  DATETIME2: 0x12,
  TIME2: 0x13,
  NEWDECIMAL: 0xf6,
  ENUM: 0xf7,
  SET: 0xf8,
  TINY_BLOB: 0xf9,
  MEDIUM_BLOB: 0xfa,
  LONG_BLOB: 0xfb,
  BLOB: 0xfc,
  VAR_STRING: 0xfd,
  STRING: 0xfe,
  GEOMETRY: 0xff
};

const myCapabilities =
  CAP.CLIENT_PROTOCOL_41 |
  CAP.CLIENT_SECURE_CONNECTION |
  CAP.CLIENT_PLUGIN_AUTH |
  CAP.CLIENT_DEPRICATE_EOF;

function SQLError (sql, params, error) {
  this.sql = sql;
  this.params = params;
  this.code = error.code;
  this.message = error.message;
}
SQLError.prototype.failure = true;
SQLError.prototype.toString = function () {
  return utils.template(CONST.ERROR_TPL, this);
}

function ErrorTracker (error, operation) {
  let sql, params;
  if (operation.statement) {
    sql = operation.statement.data;
    params = operation.data;
  } else {
    sql = operation.data;
  }
  return new SQLError(sql, params, error);
};

function MySQL(options) {
  this.options = {
    maxPacketSize: 0x1,
    encoding: 8,
    port: 3306,
    host: 'localhost'
  };
  if (options) {
    for (let option in options) {
      this.options[option] = options[option];
    }
  }
}

function getHandshakePayload(buffer) {
  let reader = new Reader(buffer);

  let result = {
    protocolVersion: reader.readInt(1)
  };
  result.serverVersion = reader.readStrNull().toString(CONST.ASCII);
  result.connectionId = reader.readInt(4);

  if (result.protocolVersion === 10) {
    result.auth = {
      data: reader.read(8)
    };
    reader.cursor++;
    result.capabilities = reader.read(2, Buffer.alloc(4));
    if (!reader.endReached()) {
      result.charset = reader.readInt(1);
      result.statusFlags = reader.read(2);
      reader.read(2, result.capabilities.slice(2));
      const authPluginDataLength = reader.readInt(1);
      // Rezerved 00x10 next.
      reader.cursor += 10;
      const nextMove = Math.max(authPluginDataLength - 8, 13);
      result.auth.data = Buffer.concat([result.auth.data, reader.read(nextMove)], nextMove + 8);
      result.auth.name = reader.readStrNull().toString(CONST.ASCII);
    }
  } else {
    // Protocol version 9
    result.auth = {
      data: reader.readStrNull().toString()
    };
  }
  return result;
}

function getPackegeInfo(buffer, resultSet) {
  let reader = new Reader(buffer);
  let length;
  let sid;
  let payload;
  let lastPacket = resultSet[resultSet.length - 1];

  if (lastPacket) {
    length = lastPacket.length - lastPacket.payload.length;
    if (length) {
      payload = reader.read(length);
      lastPacket.payload = Buffer.concat([lastPacket.payload, payload]);
    }
  }

  while (reader.cursor < reader.buffer.length) {
    length = reader.readUInt(3);
    sid = reader.readInt(1);
    payload = reader.read(length);
    lastPacket = {
      length: length,
      sid: sid,
      payload: payload
    };
    resultSet.push(lastPacket);
  }
  return lastPacket.length <= lastPacket.payload.length;
}

function bufferXor(buff1, buff2) {
  let length = Math.max(buff1.length, buff2.length);
  let result = Buffer.allocUnsafe(length);
  while (length--) {
    result[length] = buff1[length] ^ buff2[length];
  }
  return result;
}

function getCapabilities (serverCapabilities) {
  const intCapabilities = serverCapabilities.readInt32LE();
  return intCapabilities & myCapabilities;
}

const ReadPacket = {
  error: function (packet) {
    let result = null;
    const capabilities = CAP.CLIENT_PROTOCOL_41;

    if (packet[0] === 0xff) {
      let reader = new Reader(packet);
      reader.cursor++;
      result = {
        failure: true,
        code: reader.readInt(2)
      };
      if (capabilities & CAP.CLIENT_PROTOCOL_41) {
        result.sqlStateMarker = reader.read(1);
        result.sqlState = reader.read(5);
      }
      result.message = reader.readStrEof().toString();
    }
    return result;
  },
  ok: function (packet) {
    let result = null;
    const capabilities = CAP.CLIENT_PROTOCOL_41;

    if (packet[0] === 0x00 || packet[0] === 0xfe) {
      let reader = new Reader(packet);
      reader.cursor++;
      result = {
        ok: true,
        affectedRows: reader.readIntLenenc(),
        lastInsertId: reader.readIntLenenc()
      };
      if (capabilities & CAP.CLIENT_PROTOCOL_41) {
        result.flags = reader.readInt(2);
        result.warningCount = reader.readInt(2);
      } else if (capabilities & CAP.CLIENT_TRANSACTIONS) {
        result.flags = reader.readInt(2);
      }
      if (capabilities & CAP.CLIENT_SESSION_TRACK) {
        result.info = reader.readStrLenenc();
        if (result.flags & FLAG.SERVER_SESSION_STATE_CHANGED) {
          result.stateChangeInfo = reader.readStrLenenc();
        }
      } else {
        result.info = reader.readStrEof();
      }
    }
    return result;
  },
  eof: function (packet) {
    let result = null;

    if (packet[0] === 0xfe) {
      let reader = new Reader(packet);
      reader.cursor++;
      result = {
        ok: true,
        // protocol 4.1,
        warnings: reader.readInt(2),
        flags: reader.readInt(2)
      };
    }
    return result;
  },
  stmtPrepareOk: function (packet) {
    let result = null;
    if (packet[0] === 0x00) {
      let reader = new Reader(packet);
      reader.cursor++;
      result = {
        id: reader.readInt(4),
        columns: reader.readInt(2),
        params: reader.readInt(2),
        warnings: reader.skip(1).readInt(2)
      };
    }
    return result;
  },
  columnDefinition: function (packet) {
    const reader = new Reader(packet);
    let result = {
      catalog: reader.readStrLenenc(),
      schema: reader.readStrLenenc(),
      table: reader.readStrLenenc(),
      orgTable: reader.readStrLenenc(),
      name: reader.readStrLenenc(),
      orgName: reader.readStrLenenc(),
      fieldLength: reader.readIntLenenc(),
      charset: reader.readInt(2),
      length: reader.readInt(4),
      type: reader.readInt(1),
      flags: reader.readInt(2),
      decimals: reader.readInt(1)
    };
    if (!reader.endReached()) {
      result.defaultValue = reader.readStrLenenc()
    }
    return result;
  }
}

function getPacketData (payload) {
  return ReadPacket.error(payload) || ReadPacket.ok(payload) || {custom: true, payload: payload};
}

const Authentication = {};
Authentication[AUTH.MYSQL_NATIVE_PASSWORD] = function (challenge, password, callback) {
  if (challenge[challenge.length - 1] === 0x0) {
    challenge = challenge.slice(0, challenge.length - 1);
  }

  const passHash1 = crypto.createHash(CONST.SHA1);
  const passHash2 = crypto.createHash(CONST.SHA1);
  const rightHand = crypto.createHash(CONST.SHA1);
  let hashedPass;
  passHash1.on(CONST.READABLE, function () {
    hashedPass = passHash1.read();
    hashedPass && passHash2.end(hashedPass);
  });
  passHash2.on(CONST.READABLE, function () {
    const data = passHash2.read();
    data && rightHand.end(Buffer.concat([challenge, data]));
  });
  rightHand.on(CONST.READABLE, function () {
    const data = rightHand.read();
    data && callback && callback(bufferXor(hashedPass, data));
  });
  passHash1.end(password);
};

function handshakeResponse (handshake, options, callback) {
  const user = options.user;
  const pass = options.pass || '';
  const base = options.base;

  const auth = Authentication[handshake.auth.name];

  auth && auth(handshake.auth.data, Buffer.from(pass), function (data) {
    callback && callback({
      capabilities: getCapabilities(handshake.capabilities),
      maxPacketSize: options.common.maxPacketSize,
      encoding: options.common.encoding,
      username: user,
      authData: data,
      authName: handshake.auth.name,
      make: handshakeResponse.make
    });
  });
}

handshakeResponse.make = function () {
  let writer = new Writer();
  writer.writeInt(this.capabilities, 4);
  writer.writeInt(this.maxPacketSize, 4);
  writer.writeInt(this.encoding, 1);
  writer.writeInt(0, 23); // reserved
  writer.writeStrNull(this.username);
  writer.writeStrLenenc(this.authData);
  writer.writeStrNull(this.authName);

  return writer.make();
};

const Operation = {
  handshake: function (session) {
    this.session = session;
    this.phase = 0;
  },
  query: function (session, data) {
    this.session = session;
    this.data = data;
  },
  prepare: function (session, data) {
    this.session = session;
    this.data = data;
  },
  executeStatement: function (statement, data) {
    this.statement = statement;
    this.data = data;
  },
  sendLongData: {
    send: function () {
      if (!this.statement.model) {
        this.session.done(this);
      }
      const writer = new Writer();
      writer.writeInt('')
    }
  },
  operation: function (session, data, props) {
    props || (props = empty);
    this.session = session;
    this.data = data;
    this.listeners = {};
    this.ignoreErrors = props.ignoreErrors;
    this.sid = 0;
    this.response = [];
  }
};

Operation.operation.prototype.on = function (mapper) {
  for (var key in mapper) {
    this.listeners[key] = mapper[key];
  }
  return this;
}
Operation.operation.prototype.setSid = function (sid) {
  this.sid = sid % 0x100;
}
Operation.operation.prototype.getData = function (data) {
  if (getPackegeInfo(data, this.response)) {
    this.setSid(this.response[this.response.length - 1].sid + 1);
    this.onData && this.onData(this.response);
    this.response = [];
  }
}

Operation.prepare.prototype.onData = function (packets) {
  const error = ReadPacket.error(packets[0].payload);
  if (error) {
    this.session.done(this, ErrorTracker(error, this));
  } else {
    let packet = packets.shift();
    if (ReadPacket.eof(packet.payload)) {
      packet = packets.shift();
    }

    try {
      const head = ReadPacket.stmtPrepareOk(packet.payload);
      let result = {
        id: head.id,
        columns: [],
        params: []
      };

      while (head.params--) {
        result.params.push(ReadPacket.columnDefinition(packets.shift().payload));
      }
      (packets[0] && ReadPacket.eof(packets[0].payload)) && packets.shift();
      while (head.columns--) {
        result.columns.push(ReadPacket.columnDefinition(packets.shift().payload));
      }
      // console.log('prepare', this);
      this.model = result;
      this.session.done(this, result);
    } catch (error) {
      console.error('Something wrong with packege:', packet);
      console.log(packets);
      console.log(this.data);
      console.log(error);
    }
  }
}

Operation.prepare.prototype.send = function () {
  this.session.send(this.sid, Buffer.from(this.data), COM.STMT_PREPARE);
}

Operation.prepare.prototype.execute = function () {
  let operation = new Operation.operation(this.session, arguments);
  operation.statement = this;
  operation.type = 'execute';
  operation.send = Operation.executeStatement.prototype.send;
  operation.onData = Operation.query.prototype.onData;
  return this.session.do(operation);
}

Operation.prepare.prototype.sendLongData = function (param, data) {
  let operation = new Operation.operation(this.session, {param, data});
  operation.statement = this;
  operation.type = 'send long data';
  operation.send = Operation.sendLongData.send;
  return this.session.do(operation);
}

Operation.executeStatement.prototype.onData = Operation.query.prototype.onData;

Operation.executeStatement.prototype.send = function () {
  if (!this.statement.model) {
    this.session.done(this);
  }
  let writer = new Writer();
  const params = this.statement.model.params;
  writer.writeInt(COM.STMT_EXECUTE, 1);
  writer.writeInt(this.statement.model.id, 4);
  writer.writeInt(0, 1);
  writer.writeInt(1, 4);
  let nullBitmap = 0;
  let types = new Writer();
  let values = new Writer();
  const len = params.length;
  let unsigned;

  for (let i=0 ; i < len ; i++) {
    unsigned = (params[i].flags & 0x80) << 8;
    types.writeInt(params[i].type | unsigned, 2);
    if (this.data[i] === null) {
      nullBitmap |= 1 << i;
    } else {
      // console.log('param', params[i]);
      // console.log('type', types.stack);
      switch (params[i].type) {
        case TYPE.VARCHAR:
        case TYPE.VAR_STRING:
          values.writeStrLenenc(stringify(this.data[i]));
          break;
        case TYPE.TINY:
          values.writeInt(this.data[i], 1);
          break;
        case TYPE.SHORT:
        case TYPE.YEAR:
          values.writeInt(this.data[i], 2);
          break;
        case TYPE.LONG:
        case TYPE.INT24:
          values.writeInt(this.data[i], 4);
          break;
        case TYPE.LONGLONG:
          values.writeInt(this.data[i], 8);
          break;
        default:
          values.writeStrLenenc(stringify(this.data[i]));
          break;
      }
    }
  }
  const nullBitmapLength = Math.ceil(params.length / 8);
  nullBitmapLength && writer.writeInt(nullBitmap, nullBitmapLength);
  if (values.length) {
    writer.writeInt(1, 1);
    writer.writeStr(types.make());
    writer.writeStr(values.make());
  } else {  
    writer.writeInt(0, 1);
  }
  this.session.send(this.sid, writer.make());
}

function getDataByType (type, data) {
  switch (type) {
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

Operation.query.prototype.onData = function (packets) {
  if (packets.length > 1) {
    const firstPackReader = new Reader(packets[0].payload);
    const count = firstPackReader.readIntLenenc();
    let lastPacket = packets.length - 1;
    !ReadPacket.eof(packets[lastPacket].payload) && lastPacket++;
    let rows = packets.slice(count + 1, lastPacket);
    rows[0] && ReadPacket.eof(rows[0].payload) && rows.unshift();
    let row;
    let data;
    let rowData;
    let index = -1;
    let result = {
      columns: [],
      data: []
    };
    let nullBitmap;
    const nullBitmapLength = Math.ceil((count + 2) / 8);
    while (++index < count) {
      result.columns.push(ReadPacket.columnDefinition(packets[index + 1].payload));
    }
    while (row = rows.shift()) {
      row = new Reader(row.payload);
      rowData = {};
      nullBitmap = row.skip(1).readInt(nullBitmapLength);
      for (let i = 0 ; i < result.columns.length ; i++) {
        if (this.statement) {
          if (nullBitmap & 1) {
            data = getDataByType(TYPE.NULL);
          } else {
            switch (result.columns[i].type) {
              case TYPE.LONGLONG:
                data = parseInt(row.readInt(8), 10);
                break;
              case TYPE.LONG:
                data = parseInt(row.readInt(4), 10);
                break;
              case TYPE.SHORT:
                data = parseInt(row.readInt(2), 10);
                break;
              case TYPE.TINY:
                data = parseInt(row.readInt(1), 10);
                break;
              case TYPE.DOUBLE:
                data = row.read(8);
                break;
              case TYPE.FLOAT:
                data = row.read(4);
                break;
              default:
                data = getDataByType(result.columns[i].type, row.readStrLenenc());
                break;
            }
          }
          nullBitmap = nullBitmap >> 1;
        } else {
          data = getDataByType(result.columns[i].type, row.readStrLenenc());
        }
        rowData[result.columns[i].name] = data;
      }
      result.data.push(rowData);
    }
    this.session.done(this, result);
  } else {
    const packetData = getPacketData(packets[0].payload);

    this.session.done(this, packetData);
  }
}

Operation.query.prototype.send = function () {
  this.session.send(this.sid, Buffer.from(this.data), COM.QUERY);
}

Operation.handshake.prototype.onData = function (packets) {
  const _this = this;
  const packet = packets[0];
  switch (this.phase) {
    case 0:
      const handshake = getHandshakePayload(packet.payload);
      handshakeResponse(handshake, {
        user: this.session.user,
        pass: this.session.pass,
        base: this.session.base,
        common: this.session.options
      }, function (data) {
        _this.phase++;
        _this.session.capabilities = data.capabilities;
        _this.session.send(_this.sid, data.make());
      });
      break;
    case 1:
      const packetData = getPacketData(packet.payload);
      this.session.done(this, packetData);
      break;
  }
};

Operation.handshake.prototype.onError = function (packet) {
  console.log(packet.message.toString());
}

function socketTimeout () {
  this.end();
}

function Connection (params) {
  const _this = this;

  params || (params = empty);
  this.user = params.user;
  this.pass = params.pass;
  this.base = params.base;
  this.options = params.options;
  this.terminate = false;

  this.socket = new net.Socket();
  params.timeout && this.socket.setTimeout(params.timeout);
  this.phase = 0;
  let handshakeOperation = new Operation.operation(this);
  handshakeOperation.type = 'handshake';
  handshakeOperation.phase = 0;
  handshakeOperation.onData = Operation.handshake.prototype.onData;
  handshakeOperation.listeners.error = params.onError || Operation.handshake.prototype.onError;
  handshakeOperation.listeners.success = params.onSuccess;

  this.operations = [handshakeOperation];

  this.socket.on(CONST.DATA, function (data) {
    _this.operations[0] && _this.operations[0].getData(data);
  });
  this.socket.on(CONST.TIMEOUT, socketTimeout);
  params.onClose && this.socket.on(CONST.CLOSE, params.onClose);
  this.socket.on(CONST.ERROR, function (error) {
    console.log('Failed operation:', _this.operations[0].type);
    console.log(error);
  });

  this.socket.connect(this.options.port, this.options.host);
}

MySQL.prototype.connect = function(params) {
  return new Connection({
    user: params.user,
    pass: params.password,
    base: params.base,
    timeout: params.timeout || this.options.timeout,
    onSuccess: params.onSuccess,
    onError: params.onError,
    onClose: params.onClose,
    options: this.options,
  });
}

Connection.prototype.send = function (sid, data, command) {
  let length = data.length;
  command && length++;
  let writer = new Writer();
  writer.writeInt(length, 3);
  writer.writeInt(sid, 1);
  command && (writer.writeInt(command, 1));
  writer.writeStr(data);
  const result = writer.make();
  // console.log('Client: ', result);
  this.socket.write(result);
};

Connection.prototype.done = function (operation, data) {
  if (data && data.failure) {
    operation.listeners.error && operation.listeners.error(ErrorTracker(data, operation));
    if (!operation.ignoreErrors) {
      this.operations = [];
    }
  } else {
    data && operation.listeners.success && operation.listeners.success(data);
    (this.operations[0] === operation) && this.operations.shift();
    this.operations[0] && this.operations[0].send && this.operations[0].send();
  }
  !this.operations.length && this.terminate && this.socket.end();
}

Connection.prototype.do = function (operation) {
  (this.operations.push(operation) === 1) && operation.send();
  return operation;
}

Connection.prototype.query = function (data, props) {
  props || (props = empty);
  let operation = new Operation.operation(this, data, props);
  operation.send = Operation.query.prototype.send;
  operation.type = 'query';
  operation.onData = Operation.query.prototype.onData;
  operation.ignoreErrors = props.ignoreErrors;
  return this.do(operation);
}

Connection.prototype.prepare = function (stmt, props) {
  const operation = new Operation.operation(this, stmt, props);
  operation.onData = Operation.prepare.prototype.onData;
  operation.send = Operation.prepare.prototype.send;
  operation.type = 'prepare';
  operation.execute = Operation.prepare.prototype.execute;
  operation.sendLongData = Operation.prepare.prototype.sendLongData;
  return this.do(operation);
}

Connection.prototype.close = function (instant) {
  const socket = this.socket;
  if (instant || !this.operations.length) {
    socket.end();
  } else {
    this.terminate = true;
  }
};

module.exports = MySQL;

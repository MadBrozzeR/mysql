const net = require('net');
const {EMPTY, CONST, CAP, COM, PACKET} = require('./constants.js');
const Queue = require('./queue.js');
const Reader = require('./reader.js');
const Writer = require('./writer.js');
const Authentication = require('./auth.js');
const capabilities = require('./capabilities.js');
const Packets = require('./packets.js');

function SQLError (params) {
  params.sql && (this.sql = params.sql);
  params.params && (this.params = params.params);
  this.code = params.code;
  this.message = params.message;
}
SQLError.prototype.failure = true;

function handshakeResponse (handshake, callback) {
  const user = this.params.user;
  const pass = this.params.pass || '';
  const base = this.params.base;
  const session = this.params.session;

  const auth = Authentication(handshake.auth, pass, function (data) {
    data && callback && callback(Packets.writeHandshakeResponse({
      serverCapabilities: handshake.capabilities,
      user: user,
      base: base,
      authData: data,
      method: handshake.auth.name
    }, session));
  });
}

const operations = {
  handshake: {
    error: function (error) {
      this.params.onError && this.params.onError(new SQLError(error));
    },
    success: function (result) {
      this.params.onSuccess && this.params.onSuccess(result);
      this.queue.next();
    },
    data: function (packets) {
      const _this = this;
      const packet = packets[0];
      const session = this.params.session;
      this.params.sid = packet.sid;

      switch (this.params.phase) {
        case 'INIT':
          const handshake = Packets.readHandshakePayload(packet.payload);
          handshakeResponse.call(this, handshake, function (response) {
            _this.params.phase = 'CHECK';
            session.send(++_this.params.sid, response);
          });
          break;
        case 'CHECK':
          const result = Packets.readAuthMoreData(packet.payload)
            || Packets.readResultPacket(packet.payload, session);
          switch (result.type) {
            case PACKET.ERROR:
              this.queue.trigger(CONST.ERROR, result);
              break;
            case PACKET.EOF:
            case PACKET.OK:
              this.queue.trigger(CONST.SUCCESS, result);
              break;
          }
          break;
      }
    }
  },

  close: {
    init: function () {
      this.queue.clear();
      this.queue.next();
      this.params.session.close();
    }
  },

  query: {
    init: function () {
      this.params.session.send(0, [
        Writer.Integer(COM.QUERY),
        Writer.String(this.params.data)
      ]);
    },
    error: function (error) {
      this.params.onError && this.params.onError(new SQLError(error));
    },
    success: function (result) {
      this.params.onSuccess && this.params.onSuccess(result);
      this.queue.next();
    },
    data: function (packets) {
      const session = this.params.session;
      let result = Packets.readResultPacket(packets[0].payload, session)
        || Packets.readLocalInfileResponse(packets[0].payload);

      if (result) {
        switch (result.type) {
          case PACKET.ERROR:
            this.queue.trigger(CONST.ERROR, result);
            break;
          case PACKET.OK:
          case PACKET.EOF:
          case PACKET.LOCAL_INFILE:
            this.queue.trigger(CONST.SUCCESS, result);
            break;
        }
      } else {
        result = Packets.readResultset(packets, session);
        this.queue.trigger(CONST.SUCCESS, result);
      }

/*
      if (packets.length > 1) {
        const firstPackReader = new Reader(packets[0].payload);
        const count = firstPackReader.readIntLenenc();
        let lastPacket = packets.length - 1;
        !Packets.readEofPacket(packets[lastPacket].payload) && lastPacket++;
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
*/
    }
  }
}

function socketTimeout () {
  this.end();
}

function Connection (params = EMPTY) {
  const _this = this;

  this.options = params.options;

  this.socket = new net.Socket();
  params.timeout && this.socket.setTimeout(params.timeout);
  this.queue = new Queue();
  const handshake = this.queue.push(operations.handshake, {
    phase: 'INIT',
    user: params.user,
    pass: params.pass,
    base: params.base,
    onSuccess: params.onSuccess,
    onError: params.onError,
    session: this
  });

  this.socket.on(CONST.DATA, function (data) {
    console.log('server:', data);
    _this.queue.trigger(CONST.DATA, Packets.readPackets(data));
  });
  this.socket.on(CONST.TIMEOUT, socketTimeout);
  params.onClose && this.socket.on(CONST.CLOSE, params.onClose);
  this.socket.on(CONST.ERROR, function (error) {
    _this.queue.trigger(CONST.ERROR, error);
  });

  this.socket.connect(this.options.port, this.options.host);
}

Connection.prototype.send = function (sid, data) {
  const payload = Writer.Group(data);
  const result = Writer.make([
    Writer.SizeOf(payload, 3, { unsigned: true, littleEndian: true }),
    Writer.Integer(sid, 1),
    payload
  ]);

  console.log('client:', result.valueOf());
  this.socket.write(result);
};

Connection.prototype.close = function (instant) {
  const socket = this.socket;
  if (instant || this.queue.isEmpty()) {
    socket.end();
  } else {
    const operation = this.queue.push(operations.close, {session: this});
  }

  return this;
};

Connection.prototype.query = function (data, params = EMPTY) {
  const operation = this.queue.push(operations.query, {
    session: this,
    data: data,
    type: 'query',
    onSuccess: params.onSuccess,
    onError: params.onError
  });

  return this;
};

module.exports = Connection;

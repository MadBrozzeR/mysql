module.exports = {
  CONST: {
    DATA: 'data',
    END: 'end',
    ERROR: 'error',
    SUCCESS: 'success',
    CLOSE: 'close',
    TIMEOUT: 'timeout',
    ASCII: 'ascii',
    SHA1: 'sha1',
    SHA256: 'sha256',
    READABLE: 'readable',
    ERROR_TPL: 'ERROR ${code}: ${sql}\n${message}\nParams: ${params}'
  },

  RE: {
    DATETIME: /^(?:(\d{4})-(\d\d)-(\d\d))?\s?(?:(\d\d):(\d\d):(\d\d))?$/
  },

  CAP: {
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
  },

  COM: {
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
  },

  FLAG: {
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
  },

  TYPE: {
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
  },

  PACKET: {
    AUTH_MORE_DATA: 0x01,
    AUTH_SWITCH: 0xfe,
    ERROR: 0xff,
    OK: 0x00,
    EOF: 0xfe,
    LOCAL_INFILE: 0xfb,
    BINARY_PROTOCOL_ROW: 0x00
  },

  EMPTY: {}
};

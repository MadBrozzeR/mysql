# mbr-mysql

Yet another NodeJS MySQL client.

## Just an example

```
const mysql = new MySQL({
  host: 'localhost',    // Hostname (localhost is default).
  port: 3306,           // Port (3306 is default).
  maxPacketSize: 0x10,  // Max packet size to be sent to server. But it seems to be ignored by server.
  debug: false,         // Output sent and received data into console.
  timeout: 0            // Timeout of idle connection before closing.
});

const connection = mysql.connect({
  user: 'user',         // Connect as this user.
  pass: 'pass',         // User's password.
  base: 'database',     // Optional. If you wish to connect directly to database.
  timeout: 0,           // Optional. Timeout of idle connection before closing.
                        // Overwrites timeout from MySQL constructor.
  onSuccess: onSucces,  // Optional. Function to be called on successfull connection.
  onError: onError,     // Optional. Function to be called on failed connection attempt.
  onClose: onClose      // Optional. Function to be called on closed connection.
});

connection.query(
  'SELECT * FROM `table`', // Query to be executed.
  {
    onSuccess: onSuccess,   // Function to be called on successfull query.
    onError: onError        // Function to be called on failed query attempt.
  }
);

const statement = connection.prepare(
  'SELECT * FROM `table` WHERE `column`=?',   // Statement to prepare
  {
    onSuccess: onSuccess,                     // Called on successfully prepared statement.
    onError: onError                          // Called on failed prepare statement attempt.
  }
);

statement.sendLongData(
  0,                                // Index of parameter to send data to.
  Buffer.from('asd'),               // Data to send.
  {
    onError: onError                // Called in case of error.
  }
);

statement.execute(
  ['parameter value'],      // Set of parameters' values
  {
    onSuccess: onSuccess,   // Called on successfull statement execution.
    onError: onError        // Called on failed statement execution attempt.
  }
);

connection.close({
  onSuccess: onSuccess,     // Called if connection successfully closed.
  onError: onError          // Called if failed to close connection.
});
```

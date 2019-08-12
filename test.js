const MySQL = require('./index.js');

const mysql = new MySQL();

const connection = mysql.connect({
  user: 'test',
  password: 'test',
  base: 'test',
  onError
});

function onError(error) {
  console.log(error);
  connection.close();
}

const statement = connection.prepare(
  'INSERT INTO `test` (`data`, `string`, `date`) VALUES (?, ?, ?)',
  {
    onSuccess: function (packet) {
      console.log(packet);
    },
    onError
  }
);

statement.sendLongData(0, Buffer.from('111222333aaasssddd'));

statement.execute(['asde', new Date()], {
  onSuccess: function (packet) {
    console.log(packet);
  },
  onError
});

connection.close();

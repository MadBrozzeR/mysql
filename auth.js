const crypto = require('crypto');
const CONST = require('./constants.js').CONST;

const AUTH = {
  MYSQL_NATIVE_PASSWORD: 'mysql_native_password',
  CACHING_SHA2_PASSWORD: 'caching_sha2_password'
};

function bufferXor(buff1, buff2) {
  let length = Math.max(buff1.length, buff2.length);
  let result = Buffer.allocUnsafe(length);
  while (length--) {
    result[length] = buff1[length] ^ buff2[length];
  }
  return result;
}

const Authentication = {};
Authentication[AUTH.MYSQL_NATIVE_PASSWORD] = function (params, callback) {
  let challenge = params.authData;
  const password = params.pass;

  if (challenge[challenge.length - 1] === 0x0) {
    challenge = challenge.slice(0, challenge.length - 1);
  }

  const passHash1 = crypto.createHash(CONST.SHA1);
  const passHash2 = crypto.createHash(CONST.SHA1);
  const rightHand = crypto.createHash(CONST.SHA1);
  let hashedPass;
  passHash1.end(password);
  passHash1.on(CONST.READABLE, function () {
    const data = passHash1.read();
    if (data) {
      hashedPass = data; 
      hashedPass && passHash2.end(hashedPass);
    }
  });
  passHash2.on(CONST.READABLE, function () {
    const data = passHash2.read();
    data && rightHand.end(Buffer.concat([challenge, data]));
  });
  rightHand.on(CONST.READABLE, function () {
    const data = rightHand.read();
    data && callback && callback(bufferXor(hashedPass, data));
  });
};
Authentication[AUTH.CACHING_SHA2_PASSWORD] = function (params, callback) {
  let challenge = params.authData;
  const password = params.pass;

  const passHash1 = crypto.createHash(CONST.SHA256);
  const passHash2 = crypto.createHash(CONST.SHA256);
  const passHash3 = crypto.createHash(CONST.SHA256);
  const passHash4 = crypto.createHash(CONST.SHA256);

  let hashedPass;
  passHash1.end(password);
  passHash1.on(CONST.READABLE, function () {
    const data = passHash1.read();
    data && (hashedPass = data);
    data && hashedPass && passHash2.end(hashedPass);
  });
  passHash2.on(CONST.READABLE, function () {
    const data = passHash2.read();
    data && passHash3.end(data);
  });
  passHash3.on(CONST.READABLE, function () {
    const data = passHash3.read();
    data && passHash4.end(Buffer.concat([challenge, data]));
  });
  passHash4.on(CONST.READABLE, function () {
    const data = passHash4.read();
    data && callback && callback(bufferXor(hashedPass, data));
  });
};

module.exports = function (data, password, callback) {
  const auth = Authentication[data.name];

  if (auth) {
    auth({
      authData: data.data, 
      pass: Buffer.from(password)
    }, callback);
  } else {
    callback(null);
  }
};
module.exports.encryptPassword = function (pass, key, callback) {
  callback && callback(crypto.publicEncrypt(key, pass));
};

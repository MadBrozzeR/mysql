const Packets = require('./packets/index.js');

function Packer () {
  this.packets = [];
  this.incomplete = null;
}
Packer.prototype.push = function (data) {
  const restData = this.getRestData(data);

  if (restData) {
    const packets = Packets.readPackets(restData);

    for (let index = 0 ; index < packets.length ; ++index) {
      if (packets[index].complete) {
        this.packets.push(packets[index]);
      } else {
        this.incomplete = packets[index];
      }
    }
  }

  return this.get();
}
Packer.prototype.getRestData = function (data) {
  if (!data) {
    return null;
  }

  if (!this.incomplete) {
    return data;
  }

  let restData = null;

  const rest = this.incomplete.length - this.incomplete.payload.length;

  if (data.length <= rest) {
    this.append(data);
  } else {
    this.append(data.slice(0, rest));

    restData = data.slice(rest);
  }

  if (this.incomplete.length === this.incomplete.payload.length) {
    this.packets.push(this.incomplete);
    this.incomplete.complete = true;
    this.incomplete = null;
  }

  return restData;
}
Packer.prototype.append = function (data) {
  this.incomplete.payload = Buffer.concat([
    this.incomplete.payload,
    data,
  ], this.incomplete.payload.length + data.length);
}

Packer.prototype.get = function () {
  if (this.incomplete) {
    return null;
  }

  const result = this.packets;

  return result;
}

Packer.prototype.clear = function () {
  this.packets = [];

  return this;
};

module.exports = Packer;

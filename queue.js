function Queue () {
  this.queue = [];
}
Queue.prototype.push = function (action, listeners = {}) {
  if (this.queue.push({action, listeners, queue: this}) === 1) {
     this.queue[0].action();
  }
  return this.queue[0];
};
Queue.prototype.trigger = function (eventName, data) {
  this.queue[0]
    && this.queue[0].listeners[eventName]
    && this.queue[0].listeners[eventName].call(this.queue[0], data);
};
Queue.prototype.next = function () {
  this.queue.shift();
  this.queue[0] && this.queue[0].action();
};

module.exports = Queue;

const INIT = 'init';
function Queue () {
  this.queue = [];
  this.onEnd = null;
}
Queue.prototype.push = function (listeners = {}, params) {
  const element = {listeners, params, queue: this};
  if (this.queue.push(element) === 1) {
     this.trigger(INIT);
  }
  return element;
};
Queue.prototype.trigger = function (eventName, data) {
  this.queue[0]
    && this.queue[0].listeners[eventName]
    && this.queue[0].listeners[eventName].call(this.queue[0], data);
};
Queue.prototype.next = function (data) {
  this.queue.shift();
  this.queue[0] ? this.trigger(INIT, data) : (this.onEnd && this.onEnd(data));
};
Queue.prototype.clear = function () {
  this.queue = [];
  return this;
}
Queue.prototype.isEmpty = function () {
  return !this.queue.length;
}

module.exports = Queue;

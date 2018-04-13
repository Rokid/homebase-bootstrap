var util = require('util');
var prefix = 'bootstrap';
var log;

function transform() {
  return prefix + ': ' + util.format.apply(util, arguments);
}

try {
  log = require('log');
} catch (e) {
  log = {
    i: console.info,
    w: console.info,
    e: console.error,
  };
  debug('info', 'log is not loaded, use console.');
}

exports.info = debug('info');
exports.debug = debug('debug');
exports.error = debug('error');

function debug(type) {
  return function () {
    var fn;
    switch (type) {
      case 'error':
        fn = 'e';
        break;
      case 'warn':
        fn = 'w';
        break;
      default:
        fn = 'i';
        break;
    }
    log[fn](transform.apply(this, arguments));
  };
}
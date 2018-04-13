var boot = require('./_boot');
var fs = require('fs');
var logger = require('./logger');
var isAndroid = (process.platform === "android");
var exec = require('child_process').exec;
var path = require('path');
var ENV = require('./env');

// get env
// getprop -> process.env.HOMEBASE_ENV -> 'release'
exec('getprop persist.sys.rokid.homebase.env', {
  // `/bin/sh` not exist in our system, use process.env.SHELL instead
  shell: process.env.SHELL
}, function (err, stdout) {
  var env;
  if (err) {
    // swallow getprop error
    logger.info('error with getprop ' + err && err.message);
  } else {
    env = stdout;
  }
  // for test or system without getprop, use env HOMEBASE_ENV instead
  // otherwise fallback to release
  env = env || process.env.HOMEBASE_ENV || ENV.release;
  env = env.trim().toLowerCase();
  env = Object.keys(ENV).indexOf(env) === -1 ? ENV.release : env;

  var APP_HOME = process.env.APP_HOME || '/data/homebase';
  var defaultHomePath = APP_HOME;

  logger.info('env is ' + env);
  logger.info('defaultHomePath is ' + defaultHomePath  );

  var options = {
    nodeAppRoot: defaultHomePath,
    env: env
  };

  boot(options)
    .catch((error) => {
      logger.error(error.stack || error);
      logger.error('node core start error:');
      logger.error('bootstrap will exit in 10s...');
      setTimeout(() => {
        process.exit(1);
      }, 10000);
    });
});

var autoUpdate = require('./auto-update');
var fs = require('fs');
var exec = require('child_process').exec;
var fork = require('child_process').fork;
var https = require('https');
var path = require('path');
var logger = require('./logger');
var pkg = require('../package.json');

var DBUS_SERVICE = 'com.rokid.activation';
if (fs.existsSync('/usr/bin/vui-daemon')) {
  DBUS_SERVICE = 'com.rokid.AmsExport';
}

var autoUpdateTimeout = 300 * 1000

module.exports = boot;

function getDbusConfig() {
  var config = fs.readFileSync('/var/run/dbus/session').toString('utf8').split('\n')[0];
  var address = config.replace('DBUS_SESSION_BUS_ADDRESS=', '');
  return address;
}

function getDeviceInfo() {
  return new Promise((resolve, reject) => {
    logger.info('loading device info');
    process.env.DBUS_SESSION_BUS_ADDRESS = getDbusConfig();
    exec(`sh ${__dirname}/device.sh ${DBUS_SERVICE}`, (err, stdout, stderr) => {
      if (err) return reject(err);
      var data = stdout.split('\n')[1].trim().replace(/^string /, '').slice(1, -1);
      resolve(JSON.parse(data));
    });
  });
}


function getJson(pathname) {
  try {
    return JSON.parse(fs.readFileSync(pathname).toString('utf8'));
  } catch (err) {
    return null;
  }
}

/**
 * boot
 * @param options
 * @param options.nodeAppRoot path of app root
 * @param options.retryTimeout
 * @param options.env
 * @optional
 * @return {Promise}
 */
function boot(options) {
  var nodeAppRoot = options.nodeAppRoot;
  var coreAppPath, versionFile, mainEntry, device, homebaseProcess;

  function startAutoUpdate() {
    autoUpdate(coreAppPath, options.env, device)
      .then((result) => {
        // if get version and auto update both succeed
        // it means our local files is up to date,
        // we just need check update at next moment
        logger.info(`updated ${result.updated}, next ${autoUpdateTimeout}ms`)
        setTimeout(startAutoUpdate, autoUpdateTimeout);
        if (result.updated) {
          start();
        }
      }, (err) => {
        // if get version failed or auto update error,
        // it means we can't get the newest version or
        // some errors occurred while updating,
        // we need retry again asap
        var retryTimeout = options.retryTimeout + Math.floor(Math.random() * 20000)
        if (error.code === 'ENOTFOUND') {
          logger.error(`network error when installing. retry in ${retryTimeout}ms`);
        } else {
          logger.error(error);
          logger.error(`Error: core update Error, reconnecting in ${retryTimeout}ms`);
        }
        setTimeout(startAutoUpdate, retryTimeout);
      })
      .catch(err => {
        logger.error('autoUpdate error', err);
        startAutoUpdate();
      })
  }

  function start() {
    logger.info('starting node core server.');
    new Promise((resolve, reject) => {
      if (homebaseProcess) {
        logger.info(`killing existed pid ${homebaseProcess.pid}`);
        exec(`kill ${homebaseProcess.pid}`, (err, stdout, stderr) => {
          homebaseProcess = undefined;
          if (err) {
            logger.info(`kill homebase process failure ${stderr}`);
            resolve();
          } else {
            // the homebaseProcess have a value which means the homebase process is running,
            // after kill the homebase process, the close event will be fired and it will 
            // be started after 1000ms
            reject();
          }
        })
      } else {
        resolve();
      }
    }).then(() => {
      logger.info('booting node core server.');
      homebaseProcess = fork(mainEntry, [], {
        env: process.env,
      });
      homebaseProcess.on('error', (err) => {
        logger.error('core process error', err);
      });
      homebaseProcess.on('close', () => {
        logger.error('core closed, will start after 1000ms');
        setTimeout(start, 1000);
      });
    }, err => err)
  }

  return new Promise((resolve, reject) => {
    logger.info(`node bootstrap version ${pkg.version}`);
    options = Object.assign({
      retryTimeout: 10000
    }, options);

    if (!nodeAppRoot) {
      logger.error('no app home!');
      reject(new Error('no app home!'));
    } else {
      resolve();
    }
  })
    .then(getDeviceInfo)
    .then((deviceInfo) => {
      device = deviceInfo
      logger.info('deviceInfo', device);
      if (!device || !device.deviceId || !device.deviceTypeId) {
        logger.error('activation or vui is not ready');
        throw new Error('service not started');
      }

      coreAppPath = path.join(nodeAppRoot, 'core');
      mainEntry = path.join(coreAppPath, 'index.js');
      versionFile = path.join(coreAppPath, '__version');

      //  __version and main entry file to detect if core is installed
      var isInstalled = fs.existsSync(mainEntry) && fs.existsSync(versionFile);

      logger.info('node app root: ', nodeAppRoot);
      logger.info(isInstalled ? 'node core is installed.' : 'node core is not installed.');

      process.env.APP_HOME = nodeAppRoot;
      process.env.HOMEBASE_ENV = options.env;

      if (isInstalled) {
        start();
      }
      startAutoUpdate();
    }).catch((err) => {
      logger.error(err);
      throw err;
    });
}

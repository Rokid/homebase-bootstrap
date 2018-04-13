var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var https = require('https');

var logger = require('./logger');
var ENV = require('./env');
var logger = require('./logger')

module.exports = start;
var endpoint = 'https://s.rokidcdn.com/homebase/node-pkg/rokid-homebase';

function shell(command) {
  return new Promise((resolve, reject) => {
    logger.info(command);
    exec(command, (err, stdout, stderr) => {
      if (err) return reject(err);
      return resolve(stdout);
    });
  });
}

function getLatestVersion(env, device) {
  var serverEnv = {
    release: ['https://homebase.rokid.com', 'release'],
    dev: ['https://homebase-pre.rokid.com', 'dev'],
    daily: ['https://homebase.rokid-inc.com', 'dev'],
  }

  return new Promise((resolve, reject) => {
    var timer = setTimeout(() => {
      reject(new Error('request timeout'));
    }, 5000);
    var envObj = serverEnv[env] || serverEnv.release;
    var uri = `${envObj[0]}/packages/rokid-homebase/latest?env=${envObj[1]}` +
      `&sn=${device.deviceId}&device_type_id=${device.deviceTypeId}`;
    logger.info(`check ${uri}`);
    https.get(uri, (response) => {
      var data = [];
      response.on('data', (chunk) => data.push(chunk));
      response.on('end', () => {
        clearTimeout(timer);
        try {
          var json = JSON.parse(Buffer.concat(data).toString());
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}

/**
 * install or update nodejs-core
 * @param where
 * @param env
 * @returns {Promise}
 */
function start(where, env, device) {
  return new Promise((resolve, reject) => {
    var versionPath = path.join(where, '__version');
    var tempPackPath = path.join(path.dirname(where), '_temp_' + path.basename(where));
    env = env || ENV.release;

    return getLatestVersion(env, device)
      .then(remote => {
        logger.info(`get remote version ${remote.version}`)
        return remote.version
      })
      .then(onGetPackPath)

    function onError(error) {
      reject(error);
    }

    function onRenameFinish(packPath) {
      var info = {
        installedAt: new Date(),
        packPath: packPath,
      };

      fs.writeFile(versionPath, JSON.stringify(info, null, 4), (err) => {

        if (err) {
          return onError(err);
        }
        logger.info('write version success.');
        resolve({
          updated: true,
          info: info
        });
      });
    }

    function onUnPackFinish(packPath) {
      shell(`rm -rf ${where}`).then(() => {
        fs.rename(tempPackPath, where, err => {
          if (err) {
            return onError(err);
          }
          logger.info('rename success.');
          onRenameFinish(packPath);
        });
      });
    }

    function onGetPackPath(packPath) {
      var installedInfo = {};
      try {
        installedInfo = JSON.parse(fs.readFileSync(versionPath, {
          encoding: 'utf8'
        }));
        logger.info(`local version ${installedInfo.packPath}`);
      } catch (err) {
        logger.info('node core app not found, installing.');
        installedInfo = null;
      }

      if (installedInfo && installedInfo.packPath === packPath) {
        logger.info('homebase is up to date')
        resolve({
          updated: false,
          info: installedInfo
        });
        return;
      }

      var unpack = path.join(__dirname, '../unpack.sh');
      var name = packPath.trim().replace(/\.tgz$/, '');
      var match = packPath.trim().match(/-(.{6})\.tgz$/);
      if (!match || !match[1]) {
        reject(new Error('file is broken'));
        return;
      }
      logger.info('node core app new version found, installing.');
      var curlTimeout = 300
      var cmd = `sh ${unpack} ${endpoint} `+
        `${name} `+           // the package name
        `${tempPackPath} `+   // the package source
        `${match[1]} ` +      // the checksum
        `${curlTimeout}`;     // the timeout seconds for curl
      return shell(cmd).then((stdout) => {
        logger.info(stdout);
        onUnPackFinish(packPath);
      });
    }
  });
}

function httpsGet (url) {
  return new Promise((resolve, reject) => {
    var t = 5000
    var timer = setTimeout(() => {
      reject(new Error(`https get ${url} timeout after ${t}ms`))
    }, t)
    var client = https.get(url, (res) => {
      var result = [];
      res.on('data', (data) => {
        result.push(data);
      });
      res.on('end', () => {
        clearTimeout(timer)
        if (res.statusCode === 200) {
          resolve(Buffer.concat(result).toString('utf8'));
        } else {
          var error = new Error('code ' + res.statusCode);
          error.statusCode = res.statusCode;
          reject(error);
        }
      });
      res.on('error', reject);
    });
    client.on('error', reject);
  });
}

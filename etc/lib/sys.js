var exec = require('child_process').exec
var fs = require('fs')
var logger = require('../node_modules/@rokid/core-cloud-logger').get('boot')

var DBUS_SERVICE = 'com.rokid.activation'


function getDeviceInfo() {
  return new Promise((resolve, reject) => {
    exec(`sh ${__dirname}/device.sh ${DBUS_SERVICE}`, (err, stdout, stderr) => {
      if (err) {
        logger.error('sh device.sh error', stderr)
        reject(err)
        return
      }
      var data =
        stdout.split('\n')[1].trim().replace(/^string /, '').slice(1, -1)
      try {
        resolve(JSON.parse(data))
      } catch (err) {
        reject(new Error('parse dbus props json error'))
      }
    })
  })
}

module.exports = {
  getDbusConfig: function () {
    var config = fs.readFileSync('/var/run/dbus/session')
    config = config.toString('utf8').split('\n')[0]
    var address = config.replace('DBUS_SESSION_BUS_ADDRESS=', '')
    return address
  },

  getProps: function () {
    return new Promise((resolve, reject) => {
      exec('getprop', function (err, stdout, stderr) {
        if (err) {
          var execError = new Error(`${err.message}, ${stderr}`)
          reject(execError)
        } else {
          var props = {}
          stdout.split('\n').forEach(propStr => {
            var key = propStr.replace(/^\[(.*)\]: \[.*\]$/, '$1')
            var value = propStr.replace(/^\[.*\]: \[(.*)\]$/, '$1')
            if (key !== '') {
              props[key] = value
            }
          })
          resolve(props)
        }
      })
    }).then(props => {
      return getDeviceInfo().then(deviceInfo => {
        var ret = {
          sn: deviceInfo.deviceId,
          deviceTypeId: deviceInfo.deviceTypeId,
          osVersion: props['ro.build.version.release'],
          env: props['persist.sys.rokid.homebase.env'] || 'release',
          masterId: deviceInfo.masterId,
        }
        if (!ret.sn) {
          throw new Error('prop sn is incomplete')
        }
        if (!ret.deviceTypeId) {
          throw new Error('prop deviceTypeId is incomplete')
        }
        if (!ret.osVersion) {
          throw new Error('prop osVersion is incomplete')
        }
        if (!ret.env) {
          throw new Error('prop env is incomplete')
        }
        return ret
      })
    })
  }
}

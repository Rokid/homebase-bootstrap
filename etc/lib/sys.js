var exec = require('child_process').exec
var fs = require('fs')

var DBUS_CONF = {
  lua: {
    service: 'com.rokid.activation',
    objectPath: '/activation/prop',
    interface: 'com.rokid.activation.prop.all'
  },
  yodaos: {
    service: 'com.rokid.AmsExport',
    objectPath: '/activation/prop',
    interface: 'com.rokid.activation.prop.all'
  },
}

function getDeviceInfo(frameworkName) {
  var conf = DBUS_CONF[frameworkName]
  if (!conf) {
    return Promise.reject(new Error(`unsupported os name ${frameworkName}`))
  }
  return new Promise((resolve, reject) => {
    var cmd = `sh ${__dirname}/device.sh`
    var cmdArgs = `${conf.service} ${conf.objectPath} ${conf.interface}`
    exec(`${cmd} ${cmdArgs}`, (err, stdout, stderr) => {
      if (err) {
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
      var frameworkName = props['ro.rokid.build.os'] || 'lua'
      return getDeviceInfo(frameworkName).then(deviceInfo => {
        var ret = {
          sn: deviceInfo.deviceId,
          deviceTypeId: deviceInfo.deviceTypeId,
          osVersion: props['ro.build.version.release'],
          env: props['persist.sys.rokid.homebase.env'] || 'release',
          masterId: deviceInfo.masterId,
          key: deviceInfo.key,
          appSecret: deviceInfo.appSecret || deviceInfo.secret,
          enablePrint: !!props['persist.sys.rokid.homebase.prt'],
          enableUpload: !props['persist.sys.rokid.homebase.upd'],
          hardware: props['ro.boot.hardware'],
          frameworkName: frameworkName
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
        if (!ret.masterId) {
          throw new Error('prop masterId is incomplete')
        }
        return ret
      })
    })
  }
}

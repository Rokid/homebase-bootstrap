var path = require('path')
var fs = require('fs')
var fork = require('child_process').fork
var exec = require('child_process').exec
var logger = require('@rokid/core-cloud-logger').get('boot')
var rp = require('@rokid/request-promise').promisified
var serverEnv = require('./env')
var appProcess = null
var appRestartTimeout = 1000
var updateCheckInterval = 5 * 60 * 1000
var updateFailureInterval = 5 * 1000
var cdnUri = 'https://s.rokidcdn.com/homebase/node-pkg/rokid-homebase'

var nodeAppRoot
var coreAppPath
var mainEntry
var versionFilePath
var cachePath
var props

/**
 * @param {String} hint
 * @param {Error} err
 */
function onUnhandledError(hint, err) {
  logger.error(hint, err)
  // waiting for log upload
  setTimeout(() => {
    process.exit(1)
  }, 5000)
}

/**
 */
function forkProcess() {
  var env = Object.assign({}, process.env, props, {
    APP_HOME: nodeAppRoot,
    HOMEBASE_ENV: props.env,
  })
  appProcess = fork(mainEntry, [], {
    env: env,
    silent: false,
  })
  appProcess.on('error', err => {
    logger.error('core process error', err)
  })
  appProcess.on('close', () => {
    logger.error(`core closed, will start after ${appRestartTimeout}`)
    setTimeout(runApp, appRestartTimeout)
  })
  return Promise.resolve({})
}

/**
 */
function killProcess() {
  return new Promise((resolve, reject) => {
    if (!appProcess) {
      resolve()
      return
    }
    exec(`kill ${appProcess.pid}`, (err, stdout, stderr) => {
      appProcess = null
      if (err) {
        logger.error('kill app process error', stderr)
      }
      resolve()
    })
  })
}

/**
 */
function runApp() {
  var isAppInstalled = checkAppIsInstalled()
  logger.info(`app is installed: ${isAppInstalled}`)
  if (isAppInstalled) {
    return killProcess().then(() => {
      return forkProcess()
    })
  } else {
    return Promise.resolve()
  }
}

/**
 */
function checkAppIsInstalled() {
  return fs.existsSync(mainEntry) && fs.existsSync(versionFilePath)
}

/**
 * @param {String} version
 * @param {String} tempPackPath
 */
function installNewPackage(version) {
  return new Promise((resolve, reject) => {
    var sh = path.join(__dirname, './unpack.sh')
    var name = version.trim().replace(/\.tgz$/, '')
    var match = version.trim().match(/-(.{6})\.tgz$/)
    if (!match || !match[1]) {
      reject(new Error('version is not valid'))
      return
    }
    var timeout = 15
    var cmd = `sh ${sh} ${cdnUri} ${name} ${coreAppPath}` +
      ` ${cachePath} ${match[1]} ${timeout}`
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        logger.error('sh unpack.sh error', err, stderr)
        reject(new Error(err))
        return
      }
      logger.info(stdout)
      var versionPath = path.join(coreAppPath, '__version')
      var info = { installedAt: new Date(), version: version }
      fs.writeFile(versionPath, JSON.stringify(info, null, 4), err => {
        if (err) {
          logger.error('write local version file error', err)
          reject(err)
          return
        }
        resolve(true)
      })
    })
  })
}

/**
 * @param {String} remoteVersion
 * @param {String} localVersionPath
 */
function isNewVersion(remoteVersion) {
  var localVersionInfo
  try {
    localVersionInfo = JSON.parse(fs.readFileSync(versionFilePath, {
      encoding: 'utf8'
    }))
  } catch (err) {
    logger.info('local version not found')
    return true
  }
  logger.info(`local version ${localVersionInfo.version}`)
  return localVersionInfo.version !== remoteVersion.version
}

/**
 * @param {String} env release|rc|test|dev, etc...
 * @param {Object} props
 * @param {String} props.deviceId
 * @param {String} props.deviceTypeId
 * @return {Promise}
 */
function startAutoUpdate(env, props) {
  var sn = props.sn
  var deviceTypeId = props.deviceTypeId
  var serverUri = serverEnv[env]
  var resUri = `${serverUri}/packages/rokid-homebase/latest?` +
    `env=${env}&sn=${sn}&device_type_id=${deviceTypeId}`
  return rp({ uri: resUri, json: true }).then(remoteVersion => {
    logger.info('get remote version', remoteVersion)
    var isNew = isNewVersion(remoteVersion)
    if (!isNew) {
      logger.info('local version is up to date')
      return false
    }
    logger.info(`new version found ${remoteVersion.version}`)
    return installNewPackage(remoteVersion.version)
  }).then(isUpdated => {
    if (isUpdated) {
      runApp()
    }
  })
}

/**
 * @param {Object} configs
 * @param {String} configs.env
 * @param {Object?} configs.props
 * @param {String?} configs.nodeAppRoot
 */
function boot(configs) {
  var env = configs.env
  props = configs.props
  nodeAppRoot = configs.nodeAppRoot
  coreAppPath = path.join(nodeAppRoot, 'core')
  mainEntry = path.join(coreAppPath, 'index.js')
  versionFilePath = path.join(coreAppPath, '__version')
  cachePath = path.join(
    path.dirname(coreAppPath), '_temp_' + path.basename(coreAppPath)
  )

  logger.info(`env ${env}`)
  logger.info('props ', props)
  logger.info(`node app root ${nodeAppRoot}`)
  logger.info(`core app root ${coreAppPath}`)

  runApp().catch(err => {
    onUnhandledError('run error', err)
  })

  var updater = startAutoUpdate.bind(null, env, props)
  updater().then(() => {
    setTimeout(updater, updateCheckInterval)
  }, err => {
    logger.error('update error', err)
    setTimeout(updater, updateFailureInterval)
  })
}

module.exports = boot
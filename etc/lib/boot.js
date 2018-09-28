var path = require('path')
var fs = require('fs')
var fork = require('child_process').fork
var exec = require('child_process').exec
var loggerUtil = require('../node_modules/@rokid/core-cloud-logger')
var logger = loggerUtil.get('boot')
var rp = require('../node_modules/@rokid/httpdns')(logger).requestWithDNS
var serverEnv = require('./env')
var appProcess = null
var appRestartTimeout = 1000
var updateCheckInterval = 5 * 60 * 1000
var updateFailureInterval = 60 * 1000

var nodeAppRoot
var coreAppPath
var mainEntry
var versionFilePath
var cachePath
var props
var env

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
  logger.info(`forking appProcess ${mainEntry}`)
  var env = Object.assign({}, process.env, props)
  appProcess = fork(mainEntry, [], {
    env: env,
    silent: true,
    stdio: 'pipe',
  })
  appProcess.stdout.on('data', data => {
    try {
      logger.info('[core]', data.toString('utf8'))
    } catch (err) {

    }
  })
  appProcess.stderr.on('data', data => {
    try {
      logger.error('[core]', data.toString('utf8'))
    } catch (err) {

    }
  })
  appProcess.on('error', err => {
    logger.error('core process error', err)
  })
  appProcess.on('close', (code, signal) => {
    logger.error(
      `core closed ${code} ${signal}, restart in ${appRestartTimeout}ms`
    )
    loggerUtil.unwatchChild(appProcess)
    appProcess = null
    setTimeout(forkProcess, appRestartTimeout)
  })
  loggerUtil.watchChild(appProcess)
  logger.info(`forked appProcess ${mainEntry}`)
}

/**
 */
function killProcess() {
  return new Promise((resolve, reject) => {
    if (!appProcess) {
      logger.info('appProcess is not running')
      resolve(false)
      return
    }
    logger.info('killing appProcess')
    exec(`kill ${appProcess.pid}`, (err, stdout, stderr) => {
      if (err) {
        logger.error('kill app process error', stderr)
      } else {
        logger.info('killed appProcess')
      }
      resolve(true)
    })
  })
}

/**
 */
function runApp() {
  var localVersion = getLocalVersion()
  logger.info(`app installed version: ${localVersion}`)
  if (localVersion) {
    loggerUtil.setHints({ homebaseVersion: localVersion })
    killProcess().then(isRunningBefore => {
      logger.info(`appProcess isRunning before, ${isRunningBefore}`)
      /* 
        if app is running before, the 'close' event will be triggered and
        the event callback will fork the closed process in a few seconds,
        so we don't need to fork app manually, the only time we need to fork app
        manually is in boot
      */
      if (!isRunningBefore) {
        forkProcess()
      }
    }, err => onUnhandledError('run app error', err))
  }
}

/**
 */
function getLocalVersion() {
  try {
    return fs.existsSync(mainEntry) && JSON.parse(
      fs.readFileSync(versionFilePath, { encoding: 'utf8' })
    ).version
  } catch (err) {
    return null
  }
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
    var hardware = props.hardware === 'amlogic' ? '' : `-${props.hardware}`
    var cdnUri = `https://s.rokidcdn.com/homebase/node-pkg/rokid-homebase${hardware}`
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
    logger.info('get local version error', err)
    return true
  }
  logger.info(`local version ${localVersionInfo.version}`)
  return localVersionInfo.version !== remoteVersion.version
}

/**
 * @return {Promise}
 */
function startAutoUpdate() {
  function doCheck() {
    var sn = props.sn
    var deviceTypeId = props.deviceTypeId
    var serverUri = serverEnv[env]
    var hardware = props.hardware === 'amlogic' ? '' : `-${props.hardware}`
    var resUri = `${serverUri.domain}/packages/rokid-homebase${hardware}/latest?` +
      `env=${serverUri.packageEnv}&sn=${sn}&device_type_id=${deviceTypeId}`
    logger.info(`checking ${resUri}`)
    return rp({
      uri: resUri,
      json: true,
      timeout: 15000
    }).then(remoteVersion => {
      logger.info('get remote version', remoteVersion)
      var isNew = isNewVersion(remoteVersion)
      if (!isNew) {
        logger.info('local version is up to date')
        return false
      }
      logger.info(`new version found ${remoteVersion.version}`)
      return installNewPackage(remoteVersion.version)
    })
  }
  doCheck().then(isUpdated => {
    logger.info(`check finish, isUpdated: ${isUpdated}`)
    if (isUpdated) {
      runApp()
    }
    setTimeout(startAutoUpdate, updateCheckInterval)
  }, err => {
    logger.error('update error', err)
    setTimeout(startAutoUpdate, updateFailureInterval)
  })
}

/**
 * @param {Object} configs
 * @param {String} configs.env
 * @param {Object?} configs.props
 * @param {String?} configs.nodeAppRoot
 */
function boot(configs) {
  env = configs.env
  props = configs.props
  nodeAppRoot = configs.nodeAppRoot
  coreAppPath = path.join(nodeAppRoot, 'core')
  mainEntry = path.join(coreAppPath, 'index.js')
  versionFilePath = path.join(coreAppPath, '__version')
  cachePath = path.join(
    path.dirname(coreAppPath), '_temp_' + path.basename(coreAppPath)
  )

  logger.info(`env ${env}`)
  logger.info('props', props)
  logger.info(`node app root ${nodeAppRoot}`)
  logger.info(`core app root ${coreAppPath}`)

  runApp()

  startAutoUpdate()
}

module.exports = boot
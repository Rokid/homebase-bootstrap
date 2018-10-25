process.title = 'homebase-boot'
var startTime = Date.now()
var pkgInfo = require('./package.json')
var sys = require('./lib/sys')
var loggerUtil = require('./node_modules/@rokid/core-cloud-logger')
var logger = null
var retryTimeout = 5000

function onUnExceptedError(hint, err) {
  console.error(hint, err)
  console.error(`homebase boot unexcepted error, retry after ${retryTimeout}`)
  setTimeout(main, retryTimeout)
}

function main() {
  try {
    process.env.DBUS_SESSION_BUS_ADDRESS = sys.getDbusConfig()
  } catch (err) {
    onUnExceptedError('get dbus address error', err)
    return
  }
  sys.getProps().then(props => {
    props.homebaseVersion = ''
    props.boot_version = pkgInfo.version
    var nodeAppRoot = '/data/homebase'
    var homebaseEnv = props.env
    process.env.APP_HOME = nodeAppRoot
    process.env.HOMEBASE_ENV = homebaseEnv
    loggerUtil.initGlsobalOptions({
      enableStdPrint: props.enablePrint,
      enableUpload: props.enableUpload,
      sn: props.sn,
      configs: {
        bytesPerPackage: 4 * 1024,
        maxBufferBytes: 128 * 1024,
        hardware: props.hardware,
        endpoint: props.osVersion <= '3.2.0-20180925-165439' ? 'http://cn-hangzhou.log.aliyuncs.com' : ''
      }
    })
    loggerUtil.setHints(props)
    loggerUtil.startToken(props)
    logger = loggerUtil.get('boot')
    logger.log('get system props time', Date.now() - startTime)
    logger.info('cloud logger enabled: ', props.enableUpload)
    logger.info('print logger enabled: ', props.enablePrint)
    logger.info('hardware: ', props.hardware)
    var boot = require('./lib/boot')
    logger.log('require boot time', Date.now() - startTime)

    try {
      boot({ props: props, env: homebaseEnv, nodeAppRoot: nodeAppRoot })
      logger.log('boot time', Date.now() - startTime)
    } catch (err) {
      onUnExceptedError('unhandled boot error', err)
    }
  }, err => {
    onUnExceptedError('get props error', err)
  })
}

main()
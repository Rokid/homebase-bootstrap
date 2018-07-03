
var loggerUtil = require('./node_modules/@rokid/core-cloud-logger')
loggerUtil.initGlobalOptions({
  enableStdPrint: true,
  enableUpload: true,
})
var logger = loggerUtil.get('boot')
var boot = require('./lib/boot')
var sys = require('./lib/sys')

function main() {
  try {
    process.env.DBUS_SESSION_BUS_ADDRESS = sys.getDbusConfig()
  } catch (err) {
    logger.error('get dbus address error', err)
    setTimeout(() => process.exit(0), 5000)
    return
  }
  sys.getProps().then(props => {
    var nodeAppRoot = '/data/homebase'
    var homebaseEnv = props.env
    process.env.APP_HOME = nodeAppRoot
    process.env.HOMEBASE_ENV = homebaseEnv
    loggerUtil.setHints(props)
    logger.info(props)
    try {
      boot({ props: props, env: homebaseEnv, nodeAppRoot: nodeAppRoot })
    } catch (err) {
      logger.error('unhandled boot error, restart after 5s', err)
      setTimeout(() => process.exit(1), 5000)
    }
  }, err => {
    logger.error('get props error', err)
    setTimeout(main, 5000)
  })
}

main()
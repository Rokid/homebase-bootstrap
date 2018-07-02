
var loggerUtil = require('@rokid/core-cloud-logger')
loggerUtil.initGlobalOptions({
  enableStdPrint: false,
  enableUpload: true,
})
var logger = loggerUtil.get('boot')
var boot = require('./lib/boot')

function main() {
  var sys = require('./lib/sys')
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
    setTimeout(start, 5000)
  })
}

main()
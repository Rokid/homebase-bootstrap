
var loggerUtil = require('./node_modules/@rokid/core-cloud-logger')
loggerUtil.initGlobalOptions({
  enableStdPrint: true,
  enableUpload: true,
})
var logger = loggerUtil.get('boot')
var boot = require('./lib/boot')
var sys = require('./lib/sys')

function onUnExceptedError(hint, err) {
  logger.error(hint, err)
  setTimeout(() => process.exit(1), 5000)
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
    var nodeAppRoot = '/data/homebase'
    var homebaseEnv = props.env
    process.env.APP_HOME = nodeAppRoot
    process.env.HOMEBASE_ENV = homebaseEnv
    loggerUtil.setHints(props)
    try {
      boot({ props: props, env: homebaseEnv, nodeAppRoot: nodeAppRoot })
    } catch (err) {
      onUnExceptedError('unhandled boot error', err)
    }
  }, err => {
    onUnExceptedError('get props error', err)
  })
}

main()
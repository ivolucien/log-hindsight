// internal-logging.js is intended for use within the log-hindsight module only
import debug from 'debug'

export default function getScopedLoggers (subScope = '') {
  const scope = `hindsight:${subScope}${subScope !== '' ? ':' : ''}`
  const loggers = {
    trace: debug(scope + 'trace'),
    info: debug(scope + 'info'),
    error: debug(scope + 'error')
  }
  loggers.trace.log = console.debug.bind(console) // trace would print stack trace, so debug here
  loggers.info.log = console.info.bind(console)
  loggers.error.log = console.error.bind(console)
  return loggers
}

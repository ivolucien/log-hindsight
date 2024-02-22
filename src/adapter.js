// generic adapter for supported logger functionality

export const LOG_LEVELS = {
  silly: 0,
  verbose: 10,
  trace: 10,
  dir: 10,
  debug: 20,
  log: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
}
const LEVEL_NAMES = Object.keys(LOG_LEVELS)

// supports level lookup without caring if we're passed a level name or integer
export const LEVEL_LOOKUP = LEVEL_NAMES.reduce(
  (lookup, name) => {
    const level = LOG_LEVELS[name]
    lookup[name] = level
    lookup[level] = level
    return lookup
  },
  {}
)

// if the module doesn't support a log level use the closest equivalent
export const LEVEL_FALLBACK = {
  silly: ['dir', 'debug'],
  verbose: ['dir', 'debug'],
  trace: ['trace', 'verbose', 'debug'],
  dir: ['dir', 'trace', 'debug'],
  log: ['debug'],
  fatal: ['error']
}

const requiredMethods = ['debug', 'info', 'warn', 'error'];

class LogAdapter {
  logger

  static validateLogger (logger) {
    if (logger == null || typeof logger !== 'object') {
      throw new Error('Invalid logger; must be a logger object')
    }
    requiredMethods.forEach(method => {
      if (typeof logger[method] !== 'function') {
        throw new Error(`Logger must have these methods: ${requiredMethods.join(', ')}`)
      }
    })
  }

  constructor (logger) {
    LogAdapter.validateLogger(logger)

    this.logger = logger
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // Use the encapsulated method to determine the correct method name or function
        const methodName = this._resolveMethodName(prop)

        if (methodName) {
          return (...args) => this.logger[methodName](...args)
        } else if (typeof target[prop] === 'function') {
          // Ensure methods on the LogAdapter itself are correctly bound to the LogAdapter instance
          return target[prop].bind(target)
        } else if (prop in target) {
          return target[prop]
        }
        // Method not supported, return undefined or throw error
        return undefined // or throw new Error(`Method ${prop} not supported.`);
      }
    })
  }

  _avoidIrreleventLogMethod (prop) {
    // Winston using log() in its implementation, but it's not useful for our purposes
    return prop === 'log' && this.logger.transports && typeof this.logger.silly === 'function'
  }

  _resolveMethodName (prop) {
    if (typeof this.logger[prop] === 'function' && !this._avoidIrreleventLogMethod(prop)) {
      // Direct method exists on the logger
      return prop
    } else if (LEVEL_FALLBACK[prop]) {
      // Attempt to resolve a fallback method
      const fallbackMethod = LEVEL_FALLBACK[prop].find(fallback => typeof this.logger[fallback] === 'function')
      if (fallbackMethod) {
        return fallbackMethod
      }
    }
    // No direct or fallback method found
    return undefined
  }

  get logLevels () { return { ...LOG_LEVELS } }
  get levelLookup () { return { ...LEVEL_LOOKUP } }
  get levelFallback () { return { ...LEVEL_FALLBACK } }
  get levelNames () { return LEVEL_NAMES } /**

  /**
   * Creates a child logger instance - WIP, not yet implemented for console.
   *
   * @param {...any} args - Arguments to be passed to the child logger.
   * @returns {Object} - The child logger instance.
   */
  child (...args) {
    if (this.logger.child) {
      return this.logger.child(...args)
    }
    // no-op otherwise
    // todo: implement "child" functionality for console
  }

  /* Retrieves the log methods and their corresponding log levels.
   *
   * @returns {Array<Object>} - An array of log methods and their log levels.
   */
  get logMethods () {
    return this.levelNames.map(name => ({ name, level: this.levelLookup[name] }))
  }
}

export default LogAdapter

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
  fatal: 60,
};
const LEVEL_NAMES = Object.keys(LOG_LEVELS);

    // supports level lookup without caring if we're passed a level name or integer
export const LEVEL_LOOKUP = LEVEL_NAMES.reduce(
  (lookup, name) => {
    const level = LOG_LEVELS[name];
    lookup[name] = level;
    lookup[level] = level;
    return lookup;
  },
  {}
);


// if the module doesn't support a log level use the closest equivalent
export const LEVEL_FALLBACK = {
  silly: [ 'trace', 'dir', 'debug' ],
  verbose: [ 'trace', 'dir', 'debug' ],
  trace: [ 'trace', 'verbose', 'debug' ],
  dir: [ 'dir', 'trace', 'debug'],
  log: [ 'log', 'debug' ],
  fatal: [ 'error'],
};

class LogAdapter {
  logger;

  constructor(logger) {
    this.logger = logger;
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof target.logger[prop] === 'function') {
          // Direct method exists on module, bind it to ensure correct `this` context
          return target.logger[prop].bind(target.logger);
        } else if (LEVEL_FALLBACK[prop]) {
          // Attempt to resolve a fallback method
          const fallbackMethod = LEVEL_FALLBACK[prop].find(fallback => typeof target.logger[fallback] === 'function');
          if (fallbackMethod) {
            // Ensure the fallback method is also correctly bound
            return target.logger[fallbackMethod].bind(target.logger);
          }
        }
        // Method is not a logger method, attempt to call it on LogAdapter instance
        if (typeof target[prop] === 'function') {
          // Ensure methods on the LogAdapter itself are correctly bound to the LogAdapter instance
          return target[prop].bind(target);
        }
        else if (prop in target) {
          return target[prop];
        }
        // Method not supported, return undefined or throw error
        return undefined; // or throw new Error(`Method ${prop} not supported.`);
      }
    });
  }

  get logLevels() { return { ...LOG_LEVELS }; }
  get levelLookup() { return { ...LEVEL_LOOKUP }; }
  get levelFallback() { return { ...LEVEL_FALLBACK }; }
  get levelNames() { return LEVEL_NAMES; } /**

  /**
   * Creates a child logger instance - WIP, not yet implemented for console.
   *
   * @param {...any} args - Arguments to be passed to the child logger.
   * @returns {Object} - The child logger instance.
   */
  child(...args) {
    if (this.logger.child) {
      return this.logger.child(...args);
    }
    // no-op otherwise
    // todo: implement "child" functionality for console
  }

  /* Retrieves the log methods and their corresponding log levels.
   *
   * @returns {Array<Object>} - An array of log methods and their log levels.
   */
  get logMethods() {
    return this.levelNames.map(name => ({ name, level: this.levelLookup[name] }));
  }
}

export default LogAdapter;
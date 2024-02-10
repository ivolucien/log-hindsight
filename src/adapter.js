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
  static get LOG_LEVELS() { return { ...LOG_LEVELS }; }
  static get LEVEL_FALLBACK() { return { ...LEVEL_FALLBACK }; }

  /**
   * Initializes all common log methods on the LogAdapter class prototype.
   *
   * @param {Object} module - The module object with methods to call from LogAdapter.
   * @param {boolean} [forceTestInit=false] - Whether to force initialize an already initialized LogAdapter.
   * @returns {void}
   */
  static initLogMethods(module, forceTestInit = false) {
    if (typeof module !== 'object' || module.info === undefined) {
      throw new Error('LogAdapter class initialization requires a module with common logging methods.');
    }
    if (!forceTestInit && typeof LogAdapter.prototype.info === 'function') {
      return; // done if already initialized
    }

    LEVEL_NAMES.forEach((name) => {
      const fallback = LEVEL_FALLBACK[name] || [];
      // find a method that exists on the module, by preferred name or a fallback name
      const logMethod = module[name] ? name : fallback.find((name) => module[name]);

      if (module[logMethod] === undefined) {
        throw new Error(`The logger module doesn't support log level "${name}", and has no known substitute.`);
      }
      console.log({ name, moduleMethod: logMethod, fallback, type: typeof module[logMethod]});
      LogAdapter.prototype[name] = function(...args) {
        return this.module[logMethod](...args); // will refer to the module passed to the constructor
      };
      console.log(LogAdapter.prototype[name]);
    });
  }

  // class methods dynamically assigned for supported log levels in initLogMethods()
  // silly; verbose; trace; dir; debug; log; info; warn; error; fatal;

  module;
  levelNames;

  /**
   * Creates an instance of LogAdapter.
   *
   * @param {Object} module - The module object with methods to call from LogAdapter.
   * @param {Object} [logLevels=LOG_LEVELS] - The log levels to be used by the LogAdapter.
   */
  constructor(module) {
    this.module = module;
    this.levelNames =  Object.keys(LOG_LEVELS);
    LogAdapter.initLogMethods(this.module);

    // supports level lookup without caring if we're passed a level name or integer
    this.levelLookup = this.levelNames.reduce(
      (levels, name) => {
        const level = LOG_LEVELS[name];
        levels[name] = level;
        levels[level] = level;
        return levels;
      },
      {}
    );
  }

  /**
   * Creates a child logger instance - WIP, not yet implemented for console.
   *
   * @param {...any} args - Arguments to be passed to the child logger.
   * @returns {Object} - The child logger instance.
   */
  child(...args) {
    if (this.module.child) {
      return this.module.child(...args);
    }
    // no-op otherwise
    // todo: implement "child" functionality for console
  }

  /**
   * Retrieves the log methods and their corresponding log levels.
   *
   * @returns {Array<Object>} - An array of log methods and their log levels.
   */
  getLogMethods() {
    return this.levelNames.map(name => ({ name, level: this.levelLookup[name] }));
  }
}

export default LogAdapter;
import { getConfig } from './config.js';
import ConsoleProxy from "./console-proxy.js";
import LogTableManager from './log-tables.js';
import QuickLRU from 'quick-lru';

// todo: clean up debug logging before release

export const LOGGER_PROXY_MAP = {
  console: ConsoleProxy,
  // Add support for other loggers like bunyan, pino, winston, etc.
};

const DEFAULT_LOGGER = console;
let instanceId = 0; // Base counter for formatted instanceID as 'id' + instanceId integer

const LIMIT_RULE_PREFIX = 'limitBy'; // prefix for log table "limits" methods

// todo: make singleton session handling optional, and add a way to remove instances
let HindsightInstances;

/**
 * Hindsight is a logger proxy that buffers log lines and supports conditional logging rules.
 * It maintains tables of log lines for each log level, and keeps per-line metadata.
 * Can be used to associate a child logger for each user session, task or endpoint call,
 * configure output rules on a per logger basis and dynamically write log lines using custom logic.
 *
 * @class
 * @constructor
 * @param {Object} config - Hindsight configuration object, initialized instance tracking if needed.
 * @param {Object} [config.logger=console] - The logger object to be used for logging.
 * @param {Object} [config.rules] - Rule properties configuring logger instance and log line handling.
 * @param {Object} [config.proxyOverride=null] - Custom proxy object, used internally for testing.
 * @param {Object} perLineFields - The object properties to always log, stringified for singleton key.
  */
export default class Hindsight {
  // Internal log methods
  _trace; _dir; _debug; _info; _warn; _error;
  _instanceId;
  _moduleLogLevel;
  module;
  moduleName;
  proxy;
  rules;
  perLineFields = {};
  logTables;
  logMethods;

  static initSingletonTracking(instanceLimits = getConfig().instanceLimits) {
    HindsightInstances = new QuickLRU(instanceLimits); // can use in tests to reset state
  }
  static getInstances() { // for manual instance management and test use
    return HindsightInstances;
  }
  static getInstanceIndexString(perLineFields = {}) {
    return JSON.stringify(perLineFields);
  }
  static getOrCreateChild(perLineFields, parentHindsight) {
    const indexKey = Hindsight.getInstanceIndexString(perLineFields);
    parentHindsight._debug({ indexKey, perLineFields });
    const existingInstance = HindsightInstances.get(indexKey);
    return existingInstance || parentHindsight.child({ perLineFields });
  }
  getOrCreateChild(perLineFields) {
    return Hindsight.getOrCreateChild(perLineFields, this);
  }

  constructor( config = {}, perLineFields = {} ) {
    const { logger, rules, proxyOverride } = getConfig(config);

    this._setupModuleLogMethods();
    this._debug('Hindsight constructor called', { config, proxyOverride, rules, perLineFields });

    this._instanceId = instanceId++; // instance ordinal, primarily for debugging
    this.moduleName = ConsoleProxy.isConsole(logger) ? 'console' : 'unknown';
    this.module = logger;
    this.rules = rules;
    this.perLineFields = perLineFields;
    this.logTables = new LogTableManager({ maxLineCount: this.rules.lineLimits.maxCount });
    this.proxy = proxyOverride || LOGGER_PROXY_MAP[this.moduleName];

    const instanceSignature = Hindsight.getInstanceIndexString(perLineFields);
    this._debug('constructor', { instanceSignature, moduleName: this.moduleName });
    this._setupProxyLogging();

    if (HindsightInstances == null) {
      Hindsight.initSingletonTracking(config?.instanceLimits);
    }
    HindsightInstances.set(instanceSignature, this); // add to instances map?
  }

  /**
   * Gets the instance ID, prefixed with 'id' to differentiate from sequence number.
   * @returns {string} The instance ID of the Hindsight object.
   */
  get instanceId() {
    return 'id' + this._instanceId;
  }

  /**
   * Creates a Hindsight logger instance using `this` as a base, overriding perLineFields and/or rules.
   * The new instance will have a child logger instance if the original logger has child functionality.
   * @returns {Hindsight} A new Hindsight instance.
   */
  child({ perLineFields = {}, rules = {} } = {}) {
    const { module: logger, proxy: proxyOverride } = this;
    const combinedFields = { ...this.perLineFields, ...perLineFields };
    const combinedRules = { ...this.rules, ...rules };

    const innerChild = logger.child ? logger.child(perLineFields) : logger; // use child factory if available
    const childConfig = {
      instanceLimits: { maxAge: HindsightInstances.maxAge, maxSize: HindsightInstances.maxSize },
      logger: innerChild,
      proxyOverride,
      rules: combinedRules,
    };
    this._debug({ childConfig, combinedFields });
    return new Hindsight(childConfig, combinedFields);
  }

  // Get and set the current module log level, this is separate from the proxied logger.
  get moduleLogLevel() {
    return this._moduleLogLevel;
  }
  set moduleLogLevel(level) {
    this._moduleLogLevel = this.proxy.levelIntHash[level] || this.moduleLogLevel;
  }

  /**
   * Limits the log tables based on the configured rules. The method iterates over
   * each limit criteria defined in the rules, calling the corresponding private
   * line limit method for each criteria with the currently configured limit rules.
   */
  applyLineLimits() {
    Object.keys(this.rules.lineLimits).forEach((criteria) => {
      this._debug({ criteria });
      const lineLimitMethod = this.logTables[LIMIT_RULE_PREFIX + criteria];
      // call the private lineLimits method with the current lineLimits rule value
      lineLimitMethod.call(this.logTables, this.rules.lineLimits[criteria]);
    });
  }

  /**
   * Iterates over log level tables not below levelCutoff and wries all lines.
   * Call this to write this session's history. (presumes you've stored session Id in perLineFields)
   *
   * @param {string} levelCutoff - minimum required log level to write.
   *
   */
  writeLines(levelCutoff) {
    let linesToWrite = [];
    this.proxy.logTableNames.forEach((levelName) => {
      const meetsThreshold = this.proxy.levelIntHash[levelName] >= levelCutoff;
      if (!meetsThreshold) {
        return;
      }
      const levelLines = this.logTables.get(levelName);
      let sequenceCounter = 0;
      while (sequenceCounter < levelLines.counter) {
        const line = levelLines[sequenceCounter++];
        if (line != null && line.context != null) {
          line.context.name = levelName; // add name to context for writing chronologically across levels
          linesToWrite.push(line);
        }
      }
    });

    // Sort lines by line.context.timestamp in ascending order
    linesToWrite.sort((a, b) => a.context.timestamp - b.context.timestamp);

    linesToWrite.forEach((line) => {
      // todo: consider making this look async to avoid blocking the event loop for large log tables
      this._writeLine(line.context.name, line.context, line.payload);
      this.logTables.deleteLine(line.context);
    });
  }

  /**
   * Sets up internal (console) log methods for Hindsight code with '_' prefix.
   * These methods are used for logging within the Hindsight class itself.
   * @private
   */
  _setupModuleLogMethods() {
    const levelName = process.env.HINDSIGHT_LOG_LEVEL || 'error';
    this._moduleLogLevel = ConsoleProxy.levelIntHash[levelName];

    // only using standard console methods for now
    ['trace', 'debug', 'info', 'warn', 'error'].forEach((name) => {
      this['_' + name] = (...payload) => {
        // todo: use configured logger's methods instead of console
        const lineLevel = ConsoleProxy.levelIntHash[name]; // using subset of console methods
        if (lineLevel >= this._moduleLogLevel) {
          console[name](...payload);
        }
      };
    });
  }

  /**
   * Sets up proxy logging by initializing log tables and methods.
   * This method configures the proxy to intercept and manage log calls.
   * @private
   */
  _setupProxyLogging() {
    this.logMethods = this.proxy.getLogMethods();

    this.proxy.logTableNames.forEach((levelName) => {
      // populate this proxy log method
      this[levelName] = (...payload) => {
        this._logIntake({ name: levelName, level: this.proxy.levelIntHash[levelName] }, payload);
      }
      this[levelName].writeCounter = 0; // initialize counter for this log method, for tests
    });
  }

  /**
   * Logs the provided metadata and payload.
   *
   * @param {Object} metadata - The metadata object containing additional information for the log.
   * @param {Array} payload - The original args passed to the proxied log method.
   * @returns {void}
   */
  _logIntake(metadata, ...payload) {
    // pull name from metadata, set defaults for specific metadata properties
    const {
      name,
      ...context
    } = {
      name: 'info',
      timestamp: Date.now(),
      ...metadata
    };
    // todo: support options and/or format properties in metadata
    // todo: write sanitize function to remove sensitive data from log lines, if specified

    const action = this._selectAction(name, context, payload);
    this._debug({ action, context });
    if (action === 'discard') { return; }

    if (action === 'write') {
      this._writeLine(name, context, payload);
    } else if (action === 'buffer') {
      this._bufferLine(name, context, payload);
    }
  }

  _selectAction(name, context, payload) {
    // todo: move into rules module as this expands
    if (payload.length === 0) {
      return 'discard'; // log nothing if called with no payload
    }

    // todo: move to a getIntLevel() property?
    const threshold = this.proxy.levelIntHash[this.rules?.write?.level];
    const lineLevel = this.proxy.levelIntHash[context.level || name];
    this._debug({ threshold, lineLevel });
    if (lineLevel < threshold) {
      return 'buffer';
    } else {
      return 'write';
    }
  }

  // todo: support removing the log line from the log table, for now just mark as written
  /**
   * Writes a log line to the original logger method if it hasn't been written before.
   *
   * @param {string} name - The logger method to call, such as 'info' or 'error'.
   * @param {object} context - The context object to track if the log line has been written.
   * @param {Array} payload - The arguments to pass to the original logger method.
   */
  _writeLine(name, context, payload) {
    if (context.written !== true) {
      context.written = true;
      this[name].writeCounter++;
      this.module[name](...payload); // pass to the original logger method now
    }
  }

  _bufferLine(name, context, payload) {
    // get corresponding log table
    const logEntry = {
      context: { name, ...context },
      payload
    };
    this.logTables.addLine(name, logEntry);
  }
}

// todo: add lineLimits / purge function to keep to specified data limits (cullLogLines?)
// todo: add method to use rules to sanitize, keep or write log lines (logDirector?)

/*
hindsight.logTables format
LogTableManager: {
  info: {
    sequence<integer>: {
      context: {
        name<string>,
        timestamp<number>,
        sequence<integer>,
        ...<any>
      },
      payload: [
        // examples, not required
        { message: * },
        err<Error>,
        ...<any>
      ]
    }
  },
  warn: {
    ...
  },
  ...
}
*/









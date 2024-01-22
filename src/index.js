import { getConfig } from './config.js';
import ConsoleProxy from "./console-proxy.js";
import LogTableManager from './log-tables.js';

// todo: clean up debug logging before release

export const LOGGER_PROXY_MAP = {
  console: ConsoleProxy,
  // Add support for other loggers like bunyan, pino, winston, etc.
};

const DEFAULT_LOGGER = console;
let instanceId = 0; // Base counter for formatted instanceID as 'id' + instanceId integer

let HindsightInstances = {};

/**
 * Hindsight is a logger proxy that handles log lines and conditional output options.
 * It provides functionality to wrap loggers and track tables of log lines, including metadata.
 * Hindsight log tables are organized by log level names and sequence numbers.
 * It supports customization options for logging configuration and log level, and allows for
 * trimming or purging of log data to maintain specified data limits.
 *
 * @class
 * @param {Object} [logger=console] - The logger object to be used for logging.
 * @param {Object} [rules={...}] - The rules used to configure conditional logging.
 * @param {Object} [proxyOverride=null] - The test proxy object to be used for testing purposes.
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

  static getInstanceIndexString(perLineFields = {}) {
    return JSON.stringify(perLineFields);
  }
  static getOrCreateChild(perLineFields, parentHindsight) {
    const indexKey = Hindsight.getInstanceIndexString(perLineFields);
    console.debug({ indexKey, perLineFields });
    if (HindsightInstances[indexKey]) {
      return HindsightInstances[indexKey];
    }
    return parentHindsight.child({ perLineFields });
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
    this.logTables = new LogTableManager({ maxLineCount: this.rules.trim.lineCountAbove });
    this.proxy = proxyOverride || LOGGER_PROXY_MAP[this.moduleName];

    const instanceSignature = Hindsight.getInstanceIndexString(perLineFields);
    this._debug('constructor', { instanceSignature, moduleName: this.moduleName });
    this._setupProxyLogging();

    HindsightInstances[instanceSignature] = HindsightInstances[instanceSignature] || this; // add to instances map?
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
   * Gets the instance ID, prefixed with 'id' to differentiate from sequence number.
   * @returns {string} The instance ID of the Hindsight object.
   */
  get instanceId() {
    return 'id' + this._instanceId;
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
    });
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
    return new Hindsight({
      logger: innerChild,
      proxyOverride,
      rules: combinedRules
      }, combinedFields
    );
  }

  // Get and set the current module log level, this is separate from the proxied logger.
  get moduleLogLevel() {
    return this._moduleLogLevel;
  }
  set moduleLogLevel(level) {
    this._moduleLogLevel = this.proxy.levelIntHash[level] || this.moduleLogLevel;
  }

  /**
   * Trims the log tables based on the configured rules. The method iterates over
   * each trimming criteria defined in the rules, calling the corresponding private
   * trim method for each criteria with the currently configured trim rules.
   */
  applyTrimRules() {
    Object.keys(this.rules.trim).forEach((criteria) => {
      this._debug({ criteria });
      const trimMethod = this.logTables['trimBy' + criteria];
      // call the private trim method with the current trim rule value
      trimMethod.call(this.logTables, this.rules.trim[criteria]);
    });
  }

  /**
   * Iterates over log level table not below levelCutoff and wries all lines.
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
    } else if (action === 'defer') {
      this._deferToTable(name, context, payload);
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
      return 'defer';
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
      this.module[name](...payload); // pass to the original logger method now
    }
  }

  _deferToTable(name, context, payload) {
    // get corresponding log table
    const logEntry = {
      context: { name, ...context },
      payload
    };
    this.logTables.addLine(name, logEntry);
  }
}

// todo: add trim / purge function to keep to specified data limits (cullLogLines?)
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
  }
}
*/









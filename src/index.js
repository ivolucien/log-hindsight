import ConsoleProxy from "./console-proxy.js";
import RingBuffer from 'ringbufferjs';

export const LOGGER_PROXY_MAP = {
  console: ConsoleProxy,
  // Add support for other loggers like bunyan, pino, winston, etc.
};

const DEFAULT_LOGGER = console;
let instanceId = 0; // Base counter for formatted instanceID as 'id' + instanceId integer
const defaultRules = {
  write: { level: 'info' },
  trim: {
    lineCountAbove: 10 * 1000,
    lineOlderThanMs: 70 * 1000, // 70 seconds, typical max API call time + 10s
  },
};
let defaultHindsightParent = null;

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
  logMethods;
  logTables;
  logIndices;

  static getOrCreateChild({ perLineFields = {}, parentHindsight = defaultHindsightParent } = {}) {
    const instanceSignature = JSON.stringify({
      ...(defaultHindsightParent || {}).perLineFields,
      ...perLineFields
    });
    if (HindsightInstances[instanceSignature]) {
      return HindsightInstances[instanceSignature];
    }
    return parentHindsight.child({ perLineFields });
  }

  constructor({ logger = DEFAULT_LOGGER, perLineFields = {}, rules = defaultRules, proxyOverride = null } = {}) {
    this._setupModuleLogMethods();
    this._debug('Hindsight constructor called', { ...rules, proxyOverride });

    this._instanceId = instanceId++; // Used for debugging
    this.moduleName = ConsoleProxy.isConsole(logger) ? 'console' : 'unknown';
    this.module = logger;
    this.perLineFields = perLineFields;
    this.rules = { ...defaultRules, ...rules };
    this.logIndices = {
      sequence: new RingBuffer(
        this.rules.trim.lineCountAbove, // max total of all log lines
        (line) => this._trimCorrespondingDataFromTable(line.context) // eviction callback for when buffer is full
      )
    };
    this.proxy = proxyOverride || LOGGER_PROXY_MAP[this.moduleName];
    this._debug({ this: this });

    this._setupProxyLogging();
    defaultHindsightParent = defaultHindsightParent || this;
    const instanceSignature = JSON.stringify({ perLineFields });
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

    ['trace', 'dir', 'debug', 'info', 'warn', 'error'].forEach((name) => {
      this['_' + name] = (...payload) => {
        const lineLevel = ConsoleProxy.levelIntHash[name];
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
    this.logTables = {};
    this.logMethods = this.proxy.getLogMethods();

    this.proxy.logTableNames.forEach((levelName) => {
      // initialize log table for log level name
      this.logTables[levelName] = { counter: 1 };

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

    const child = logger.child ? logger.child(perLineFields) : logger; // use child factory if available
    return new Hindsight({ child, perLineFields: combinedFields, proxyOverride, rules: combinedRules });
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
      const trimMethod = this['_trimBy' + criteria];
      trimMethod.call(this, this.rules.trim[criteria]);
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
      const levelLines = this.logTables[levelName];
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
      this._writeLine(line.context.name, line.context, line.payload);
    });
  }

  /**
   * Retrieves the log table associated with the given name.
   * If the table does not exist, a new table object is created and returned.
   *
   * @param {string} levelName - The name of the table, such as 'info' or 'error'.
   * @returns {object} The log line table associated with the given log level name.
   */
  _getTable(levelName) {
    return this.logTables[levelName];
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
    const table = this._getTable(name);
    context.sequence = table.counter++;
    // assign log line in sequence to the log level table
    table[context.sequence] = {
      context: { name, ...context },
      payload
    };
    this.logIndices.sequence.enq(table[context.sequence]); // add to sequence index
    this._debug({ ...context, deferTargetTable: table });
  }

  // todo: write eviction callback for each line exceeding the max line count, prune from log table
  _trimCorrespondingDataFromTable(context) {
    const levelTable = this._getTable(context.name);
    delete levelTable[context.sequence];
  }

  _trimBylineCountAbove() {
    // no-op for the ringbufferjs as it maintains max size and triggers the eviction callback when full
    this._debug('Trimming by line count above threshold', { maxLineCount: this.rules.trim.lineCountAbove });
  }

  // call this via setTimeout to avoid caller code delay
  _trimBylineOlderThanMs() {
    const oldestAllowed = Date.now() - this.rules.trim.lineOlderThanMs;

    while (this.logIndices.sequence.peek().context.timestamp < oldestAllowed) {
      // remove line from table
      const line = this.logIndices.sequence.peek();
      this._debug({ line });

      // remove line from other structures
      this._trimCorrespondingDataFromTable(line.context);

      // remove sequence index reference
      this.logIndices.sequence.deq();
      // todo: support expiration callback for each line removed?
    }
  }
}

// todo: add trim / purge function to keep to specified data limits (cullLogLines?)
// todo: add method to use rules to sanitize, keep or write log lines (logDirector?)

/*
hindsight.logTables format
{
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









import ConsoleProxy from "./console-proxy.js";
import RingBuffer from 'ringbufferjs';

export const LOGGER_PROXY_MAP = {
  console: ConsoleProxy,
  // Add support for other loggers like bunyan, pino, winston, etc.
};

const DEFAULT_LOGGER = 'console';
let instanceId = 0; // Base counter for formatted instanceID as 'id' + instanceId integer
const defaultRules = {
  write: { level: 'info' },
  trim: {
    lineCountAbove: 10 * 1000,
    lineOlderThanMs: 70 * 1000, // 70 seconds, typical max API call time + 10s
  },
};
/**
 * Hindsight is a logger proxy that handles log lines and conditional output options.
 * It provides functionality to wrap loggers and track tables of log lines, including metadata.
 * Hindsight log tables are organized by log level names, session IDs, and sequence numbers.
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
  logMethods;
  logTables;
  logIndices;

  constructor({ logger = console, rules = defaultRules, proxyOverride = null } = {}) {
    this._setupModuleLogMethods();
    this._debug('Hindsight constructor called', { ...rules, override: typeof proxyOverride });

    this._instanceId = instanceId++; // Used for default sessionId
    this.moduleName = ConsoleProxy.isConsole(logger) ? 'console' : 'unknown';
    this.module = logger;
    this.rules = { ...defaultRules, ...rules };
    this.logIndices = {
      sequence: new RingBuffer(
        this.rules.trim.lineCountAbove, // max total of all log lines
        (line) => this._trimCorrespondingDataFromTable(line.context) // eviction callback for when buffer is full
      )
    };
    this.proxy = proxyOverride || LOGGER_PROXY_MAP[this.moduleName];

    this._setupProxyLogging();
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

    this.proxy.logTableNames.forEach((name) => {
      // initialize log table for log level name
      const defaultSessionRecord = {};
      defaultSessionRecord[this.instanceId] = { counter: 1 };
      this.logTables[name] = defaultSessionRecord;

      // populate this proxy log method
      this[name] = (...payload) => {
        this._logIntake({ name, level: this.proxy.levelIntHash[name] }, payload);
      };
    });
  }

  /**
   * Creates a new Hindsight logger instance with the same logger and proxy.
   * @returns {Hindsight} A new Hindsight instance.
   */
  createLogger() {
    const logger = this.module;
    return new Hindsight({ logger, proxyOverride: this.proxy });
  }

  /**
   * Gets the current module log level.
   * @returns {number} The current log level of the module.
   */
  get moduleLogLevel() {
    return this._moduleLogLevel;
  }

  /**
   * Sets the module log level, this is separate from the proxied logger.
   * @param {string} level - The new log level to set for the module.
   */
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
   * Iterates over log level table not below levelCutoff and wries all lines for the given session ID.
   *
   * @param {string} sessionId - set of log lines to apply the rule to.
   *
   */
  writeSessionLines(sessionId, levelCutoff) {
    let sessionLines = [];
    this.proxy.logTableNames.forEach((name) => {
      const meetsThreshold = this.proxy.levelIntHash[name] >= levelCutoff;
      if (!meetsThreshold) {
        return;;
      }
      const levelLines = this.logTables[name][sessionId];
      let sequenceCounter = 0;
      while (sequenceCounter < levelLines.counter) {
        const line = sessionLines[sequenceCounter++]; // todo: consider using ring buffer for session table
        if (line == null || line.context == null) {
          continue;
        }

        line.context.name = name; // add name to context for writing chronologically across levels
        sessionLines.push(line);
      }
    });

    // Sort sessionLines by line.context.timestamp in ascending order
    sessionLines.sort((a, b) => a.context.timestamp - b.context.timestamp);

    sessionLines.forEach((line) => {
      this._writeLine(line.context.name, line.context, line.payload);
    });
  }

  /**
   * Retrieves the log table associated with the given name and session ID.
   * If the table does not exist, a new table object is created and returned.
   *
   * @param {string} name - The name of the table, such as 'info' or 'error'.
   * @param {string} [sessionId] - The session ID, defaults to the hindsight instance ID.
   * @returns {object} The log line table associated with the given name and session ID.
   */
  _getTable(name, sessionId = this.instanceId) {
    // get or add log level table
    const namedTable = this.logTables[name] || {};
    this.logTables[name] = namedTable;

    // get or add session table
    namedTable[sessionId] = namedTable[sessionId] || { counter: 1};
    // console.dir({ namedTable, counter: namedTable[sessionId].counter });

    return namedTable[sessionId];
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
      sessionId: this.instanceId, // instance ID acts as a bucket for all non-session logs
      timestamp: Date.now(),
      ...metadata
    };
    // todo: support options and/or format properties in metadata
    // todo: write sanitize function to remove sensitive data from log lines, if specified

    const action = this._selectAction(name, context, payload);
    if (action === 'discard') { return; }

    if (action === 'write') {
      this._writeLine(name, context, payload);
    } else if (action === 'defer') {
      this._deferToTable(name, context, payload);
    } // todo: purge function to remove this log line from the table by session ID and age
    
    // todo: trim function to keep to specified data limits (cullLogLines?)
  }

  _selectAction(name, context, payload) {
    // todo: move into rules module as this expands
    if (payload.length === 0) {
      return 'discard'; // log nothing if called with no payload
    }

    // todo: move to a get intLevel() property?
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
    const table = this._getTable(name, context.sessionId);
    context.sequence = table.counter++;
    // assign log line in sequence to the session table
    table[context.sequence] = {
      context: { name, ...context },
      payload
    };
    this.logIndices.sequence.enq(table[context.sequence]); // add to sequence index
    this._debug({ name, payloads: Object.values(table) });
  }

  // todo: write eviction callback for each line exceeding the max line count, prune from log table
  _trimCorrespondingDataFromTable(context) {
    const sessionTable = this._getTable(context.name, context.sessionId);
    delete sessionTable[context.sequence];
    if (Object.keys(sessionTable).length === 1 && typeof sessionTable.counter === 'number') {
      delete table[context.sessionId];
    }
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
    sessionId<any|instanceId>: {
      sequence<integer>: {
        context: {
          timestamp,
          sessionId<any>,
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
}
*/









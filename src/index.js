/**
 * Hindsight is a logger proxy that handles log lines and conditional output options.
 * 
 * It provides functionality to wrap loggers and track tables of log lines, including metadata.
 * Hindsight log tables are organized by log level names, session IDs and sequence numbers.
 * It supports customization options for logging configuration and log level, and allows for
 * trimming or purging of log data to maintain specified data limits.
 *
 * @class
 * @constructor
 * @param {Object} [logger=console] - The logger object to be used for logging.
 * @param {Object} [rules={}] - The rules object used to configure conditional logging.
 * @param {Object} [testProxy=null] - The test proxy object to be used for testing purposes.
 */

import ConsoleProxy from "./console-proxy.js";

// todo: support bunyan, pino, winston, etc.
export const LOGGER_PROXY_MAP = {
  console: ConsoleProxy,
};

const DEFAULT_LOGGER = 'console';
let instanceId = 0; // base counter, formatted instanceID is 'id' + instanceId integer

// Logger proxy handling log line access and management
export default class Hindsight {
  _moduleLogLevel;
  _trace; _dir; _debug; _info; _warn; _error; // internal log methods
  _instanceId; // todo: add instanceId to metadata and set default to uuid or counter?
  module;
  moduleName;
  proxy;
  rules;

  logMethods;
  logTables;

  constructor({
    logger = console,
    rules = { write: { level: logger.level || 'info' } },
    proxyOverride = null
  } = {}) {
    this._setupModuleLogMethods();
    this._debug('Hindsight constructor called');

    this._instanceId = instanceId++; // used for default sessionId
    // todo: move to a getLoggerName function
    this.moduleName = ConsoleProxy.isConsole(logger) ? 'console' : 'unknown';
    this.module = logger;
    this.rules = rules;

    // setup logger proxy, use test proxy if passed in
    this.proxy = proxyOverride || LOGGER_PROXY_MAP[this.moduleName];

    this._setupProxyLogging();
  }

    // setup internal (console) log methods for hindsight code with '_' prefix
  _setupModuleLogMethods() {
    const levelName = process.env.HINDSIGHT_LOG_LEVEL || 'error';
    this._moduleLogLevel = ConsoleProxy.levelIntHash[levelName];

    ['trace', 'dir', 'debug', 'info', 'warn', 'error'].forEach((name) => {
      this['_' + name] = (...payload) => {
        const lineLevel = ConsoleProxy.levelIntHash[name];
        console.debug({ env: process.env.HINDSIGHT_LOG_LEVEL, lineLevel, moduleLogLevel: this._moduleLogLevel });

        if (lineLevel >= this._moduleLogLevel) {
          console[name](...payload);
        }
      };
    })
  }

  // prefix  with 'id' to differentiate from sequence number
  get instanceId() {
    return 'id' + this._instanceId;
  }

  _setupProxyLogging() {
    this.logTables = {};
    this.logMethods = this.proxy.getLogMethods();

    this.proxy.logTableNames.forEach((name) => {
      // create log table object
      this.logTables[name] = {};
      // setup log method proxy for caller, passing in logger method name and log level
      this[name] = (...payload) => {
        this.logIntake({
          name,
          level: this.logMethods[name].level
        }, payload); // expects payload to be an arg array
      }
    });
  }

  // TODO: Test the createLogger method and verify that it returns a new Hindsight instance with the correct logger and proxy
  // todo: add options parameter and most common base logger options
  createLogger() {
    const logger = this.module;
    return new Hindsight({ logger, proxyOverride: this.proxy });
  }

  get moduleLogLevel() { return this._moduleLogLevel; }

  set moduleLogLevel(level) {
    this._moduleLogLevel = this.proxy.levelIntHash[level] || this.moduleLogLevel;
  }
  /**
   * Retrieves the log table associated with the given name and session ID.
   * If the table does not exist, a new table object is created and returned.
   *
   * @param {string} name - The name of the table, such as 'info' or 'error'.
   * @param {string} [sessionId] - The session ID, defaults to the hindsight instance ID.
   * @returns {object} The log line table associated with the given name and session ID.
   */
  getTable(name, sessionId = this.instanceId) {
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
  logIntake(metadata, ...payload) {
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
    // console.log({ name, instanceId: this.instanceId, context, payload });

    const action = this.selectAction(name, context, payload);
    if (action === 'discard') { return; }

    if (action === 'write') {
      this.module[name](...payload); // pass to the original logger method
    } else if (action === 'defer') {
      this.deferToTable(name, context, payload);
    } // todo: purge function to remove this log line's session table
    
    // todo: trim function to keep to specified data limits (cullLogLines?)
  }

  selectAction(name, context, payload) {
    // todo: move into rules module as this expands
    if (payload.length === 0) {
      return 'discard'; // log nothing if called with no payload
    }

    // todo: move to a getRank() method?
    const threshold = this.proxy.levelIntHash[this.rules?.write?.level];
    const lineLevel = this.proxy.levelIntHash[context.level || name];
    console.dir({ threshold, lineLevel });
    if (lineLevel < threshold) {
      return 'defer';
    } else {
      return 'write';
    }
    // todo: handle rules to purge log line
  }

  deferToTable(name, context, payload) {
    // get corresponding log table
    const table = this.getTable(name, context.sessionId);
    context.sequence = table.counter++;
    // assign log line in sequence
    table[context.sequence] = {
      context,
      payload
    };
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









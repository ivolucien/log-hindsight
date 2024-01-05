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
 * @param {Object} [testProxy=null] - The test proxy object to be used for testing purposes.
 */

import ConsoleProxy from "./console-proxy.js";

export const LOGGER_PROXY_MAP = {
  console: ConsoleProxy,
};

const DEFAULT_LOGGER = 'console';
let instanceId = 0;

// Logger proxy handling log line access and management
export default class Hindsight {
  module;
  name;
  proxy;
  instanceId; // todo: add instanceId to metadata and set default to uuid or counter?
  logTables;

  constructor(logger = console, testProxy = null) {
    console.log('constructor: called');
    // todo: move to a getLoggerName function
    this.instanceId = instanceId++; // used for default sessionId
    this.name = ConsoleProxy.isConsole(logger) ? 'console' : 'unknown';
    this.module = logger;

    // setup logger proxy, use test proxy if passed in
    const haveProxy = LOGGER_PROXY_MAP[this.name] != null || testProxy != null;
    this.proxy = testProxy || LOGGER_PROXY_MAP[this.name];

    // todo: support logging configuration for Hindsight itself, inc. log level
    // console.log({
    //   name: this.name,
    //   instanceId: this.instanceId,
    //   haveProxy,
    //   isConsole: ConsoleProxy.isConsole(logger),
    // });

    this.logTables = {};
    this.proxy.getLogTableNames().forEach((name) => {
      this.logTables[name] = {};
    });
  }

  // todo: add options parameter and most common base logger options
  createLogger() {
    const rawLogger = this.module;
    return new Proxy(rawLogger, this.proxy)
  }

  /**
   * Retrieves the log table associated with the given name and session ID.
   * If the table does not exist, a new table object is created and returned.
   *
   * @param {string} name - The name of the table, such as 'info' or 'error'.
   * @param {string} [sessionId] - The session ID, defaults to the hindsight instance ID.
   * @returns {object} The log line table associated with the given name and session ID.
   */
  getTable(name, sessionId) {
    // get or add log level table
    const namedTable = this.logTables[name] || {};
    this.logTables[name] = namedTable;

    // get or add session table
    namedTable[sessionId] = namedTable[sessionId] || { counter: 1};
    // console.dir({ namedTable, counter: namedTable[sessionId].counter });

    return namedTable[sessionId];
  }

  // prefix  with 'id' to differentiate from sequence number
  get instanceId() {
    return 'id' + this.instanceId;
  }

  // todo: support options and/or format properties in metadata
  /**
   * Logs the provided metadata and payload.
   *
   * @param {Object} metadata - The metadata object containing additional information for the log.
   * @param {Array} payload - The original args passed to the proxied log method.
   * @returns {void}
   */
  log(metadata, ...payload) {
    const {
      name,
      ...context
    } = {
      name: 'info',
      sessionId: this.instanceId, // instance ID acts as a bucket for all non-session logs
      timestamp: Date.now(),
      ...metadata
    };
    // console.log({ name, instanceId: this.instanceId, context, payload });

    // get corresponding log table
    const table = this.getTable(name, context.sessionId);
    context.sequence = table.counter++;
    // assign log line in sequence
    table[context.sequence] = {
      context,
      payload
    };
    // todo: call the trim / purge function to keep to specified data limits
  }
}

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









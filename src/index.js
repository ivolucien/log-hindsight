import ConsoleProxy from "./console-proxy.js";
import HashMap from "hashmap";

export const LOGGER_PROXY_MAP = {
  console: ConsoleProxy,
};

const DEFAULT_LOGGER = 'console';

// Logger proxy handling payload access and management
export default class Hindsight {
  module;
  name;
  proxy;
  instanceId; // todo: add instanceId to metadata and set default to uuid or counter?
  logTables;

  constructor(logger = console, testProxy = null) {
    console.log('constructor: called');
    // todo: move to a getLoggerName function
    this.name = ConsoleProxy.isConsole(logger) ? 'console' : 'unknown';
    this.module = logger;

    // setup logger proxy, use test proxy if passed in
    const haveProxy = LOGGER_PROXY_MAP[this.name] != null || testProxy != null;
    this.proxy = testProxy || LOGGER_PROXY_MAP[this.name];

    // todo: support logging configuration for Hindsight itself, inc. log level
    console.log({
      name: this.name,
      haveProxy,
      isConsole: ConsoleProxy.isConsole(logger),
    });

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

  tableInit(name, sessionId) {
    if (this.logTables[name] == null) {
      throw new Error('log table not found');
    }
    this.logTables[name][sessionId] = new HashMap();
    return this.logTables[name][sessionId];
  }

  // todo: add options and/or format param(s)
  log(metadata, payload) {
    let context = {
      table: 'info',
      sessionId: this.instanceId,
      timestamp: Date.now(),
      ...metadata
    };
    const name = context.table || context.level;
    const table = this.tableInit(name, context.sessionId);
    const sequenceId = table.counter++;
    table.set("${timestamp}.${sequenceId}}, {
      timestamp,
      ...payload
    });
    // todo: call the trim / purge function to keep to specified data limits
  }
}

/*
data format brainstorming

{
  info: HashMap {
    sessionId: theLogLine {
      <timestamp>.<sequenceId>: {
        timestamp,
        message: *,
        error: *,
        ...
      }
    },
    possibly add -> sequenceId: theLogLine { same obj as above }
  }
}
*/









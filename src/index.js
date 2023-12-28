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
      this.logTables[name] = new HashMap();
    });
  }

  // todo: add options parameter and most common base logger options
  createLogger() {
    const rawLogger = this.module;
    return new Proxy(rawLogger, this.proxy)
  }

  // todo: add method to push log message to the relevant level table
  log(metadata, message, ...additionalParams) {
    let context = {
      level: 'info',
      sessionId: this.instanceId,
      timestamp: Date.now(),
      ...metadata
    };
    // todo: add the data to the relevent logTable, either by name or log level integer
    // todo: call the trim / purge function to keep to specified data limits
  }
}

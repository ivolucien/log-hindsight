import ConsoleProxy from "./console-proxy.js";
import Queue from 'better-queue';

export const LOGGER_PROXY_MAP = {
  console: ConsoleProxy,
};

const DEFAULT_LOGGER = 'console';

// General logger and payload queue management
export default class Hindsight {
  module;
  name;
  proxy;
  queues;

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

    this.queues = {};
    this.proxy.getQueueNames().forEach((name) => {
      this.queues[name] = new Queue(function tempNoOp() {});
    });
  }

  // todo: add options parameter and most common base logger options
  createLogger() {
    const rawLogger = this.module;
    return new Proxy(rawLogger, this.proxy)
  }
}

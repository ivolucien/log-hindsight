import ConsoleProxy from "./console-proxy.js";
import Queue from 'better-queue';

export const PROXY_MAP = {
  'console': ConsoleProxy,
};

const DEFAULT_LOGGER = 'console';

export default class Hindsight {
  module;
  name;
  proxy;
  queues;

  constructor(logger = { console }, proxy = null) {
    console.log('constructor: called');
    console.log({
      loggerKeys: Object.keys(logger),
      proxyKeys: proxy ? Object.keys(proxy) : null,
    });
    this.name = Object.keys(logger)[0]; // get logger module name as string
    this.module = logger[this.name];

    const haveProxy = PROXY_MAP[this.name] != null || proxy != null
    if (!haveProxy) {
      // No proxy wrapper for logger param, using "console" proxy
      this.name = DEFAULT_LOGGER;
    }
    this.proxy = proxy || PROXY_MAP[this.name];

    this.queues = {};
    this.proxy.getQueueNames().forEach((name) => {
      this.queues[name] = new Queue(function tempNoOp() {});
    });
  }

  createLogger(options) {
    const rawLogger = this.proxy.useModuleDirectly
      ? this.module
      : this.module.createLogger(options);
    return new Proxy(rawLogger, this.proxy)
  }
}
// config.js
import ConsoleProxy from "./console-proxy.js";

export const defaultConfig = {
  instanceLimits: {
    maxSize: 5 * 1000,
    maxAge: 70 * 1000,
  },
  logger: console,
  moduleLogLevel: process.env.HINDSIGHT_LOG_LEVEL || 'error', // log level of hindsight module itself
  rules: {
    write: { level: 'info' },
    trim: {
      lineCountAbove: 10 * 1000,
      lineOlderThanMs: 70 * 1000,
    },
  },
  proxyOverride: null,
};

// spell out supported properties, the || syntax prevents falsy caller override values
export function getConfig(caller = {}, env = process.env.NODE_ENV) {
  const envConfig = envConfigs[env] || envConfigs['production'];
  const config = {
    instanceLimits: caller.instanceLimits || envConfig.instanceLimits,
    logger: caller.logger || envConfig.logger,
    moduleLogLevel: caller.moduleLogLevel || envConfig.moduleLogLevel,
    rules: {
      write: { ...envConfig.rules.write, ...caller?.rules?.write },
      trim: { ...envConfig.rules.trim, ...caller?.rules?.trim }
    },
    proxyOverride: caller.proxyOverride,
  };
  return config;
};

export const envConfigs = {
  test: {
    ...defaultConfig,
    instanceLimits: {
      maxSize: 5,
      maxAge: 500,
    },
    moduleLogLevel: process.env.HINDSIGHT_LOG_LEVEL || 'debug',
    rules: {
      write: { level: 'info' },
      trim: {
        lineCountAbove: 10,
        lineOlderThanMs: 100,
      }
    }
  },
  'test-trace': {
    ...defaultConfig,
    instanceLimits: {
      maxSize: 5,
      maxAge: 500,
    },
    moduleLogLevel: process.env.HINDSIGHT_LOG_LEVEL || 'trace',
    rules: {
      write: { level: 'info' },
      trim: {
        lineCountAbove: 10,
        lineOlderThanMs: 100,
      }
    }
  },
  'test-stress': {
     ...defaultConfig,
     rules: {
      write: { level: 'error' },
      trim: {
        lineCountAbove: 1000 * 1000,
        lineOlderThanMs: 130 * 1000, // 130 seconds for extended retention period
      },
    },
  },
  production: {
     ...defaultConfig,
  }
};

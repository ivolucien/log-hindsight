// config.js
import ConsoleProxy from "./console-proxy.js";

export const defaultConfig = {
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

// spell out supported properties, avoid overriding with falsy caller values
export function getConfig(caller = {}, env = process.env.NODE_ENV) {
  const envConfig = envConfigs[env] || envConfigs['production'];
  const config = {
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

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
    lineLimits: {
      maxCount: 10 * 1000,
      maxAgeMs: 70 * 1000,
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
      lineLimits: { ...envConfig.rules.lineLimits, ...caller?.rules?.lineLimits }
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
      lineLimits: {
        maxCount: 10,
        maxAgeMs: 100,
      }
    }
  },
  development: {
    ...defaultConfig,
    instanceLimits: {
      maxSize: 5,
      maxAge: 500,
    },
    moduleLogLevel: process.env.HINDSIGHT_LOG_LEVEL || 'trace',
    rules: {
      write: { level: 'info' },
      lineLimits: {
        maxCount: 10,
        maxAgeMs: 100,
      }
    }
  },
  stress: {
     ...defaultConfig,
     instanceLimits: {
      maxSize: 50 * 1000,
      maxAge: 130 * 1000,
    },
     rules: {
      write: { level: 'error' },
      lineLimits: {
        maxCount: 1000 * 1000,
        maxAgeMs: 130 * 1000, // 130 seconds for extended retention period
      },
    },
  },
  production: {
     ...defaultConfig,
  }
};

// config.js

export const defaultConfig = {
  instanceLimits: {
    maxSize: 5 * 1000, // 5k instances
    maxAge: 70 * 1000 // 70 second LRU idle timeout
  },
  lineLimits: {
    maxAge: 70 * 1000, // 70 seconds
    maxBytes: 100 * 1000 * 1000, // 100 MB
    maxSize: 1000 * 1000 // 1 M lines
  },
  logger: console,
  moduleLogLevel: process.env.HINDSIGHT_LOG_LEVEL || 'error', // log level of hindsight module itself
  writeWhen: { level: 'info' }
}

// spell out supported properties, the || syntax prevents falsy caller override values
export function getConfig (caller = {}, env = process.env.NODE_ENV) {
  const envConfig = envConfigs[env] || envConfigs.production
  const config = {
    instanceLimits: caller.instanceLimits || envConfig.instanceLimits,
    logger: caller.logger || envConfig.logger,
    lineLimits: { ...envConfig.lineLimits, ...caller?.lineLimits },
    moduleLogLevel: caller.moduleLogLevel || envConfig.moduleLogLevel,
    writeWhen: { ...envConfig.writeWhen, ...caller?.writeWhen }
  }
  return config
};

export const envConfigs = {
  test: {
    ...defaultConfig,
    instanceLimits: {
      maxAge: 500,
      maxSize: 5
    },
    lineLimits: {
      maxAge: 100,
      maxBytes: 1000,
      maxSize: 10
    },
    moduleLogLevel: process.env.HINDSIGHT_LOG_LEVEL || 'debug',
    writeWhen: { level: 'info' }
  },
  development: {
    ...defaultConfig,
    instanceLimits: {
      maxAge: 180 * 1000,
      maxSize: 5
    },
    lineLimits: {
      maxAge: 100,
      maxBytes: 1000,
      maxSize: 10
    },
    moduleLogLevel: process.env.HINDSIGHT_LOG_LEVEL || 'trace',
    writeWhen: { level: 'info' }
  },
  stress: {
    ...defaultConfig,
    instanceLimits: {
      maxAge: 130 * 1000,
      maxSize: 50 * 1000
    },
    lineLimits: {
      maxAge: 130 * 1000, // 130 seconds for extended retention period
      maxBytes: 500 * 1000 * 1000, // 500 MB
      maxSize: 10 * 1000 * 1000 // 10 M lines
    },
    writeWhen: { level: 'error' }
  },
  production: {
    ...defaultConfig
  }
}

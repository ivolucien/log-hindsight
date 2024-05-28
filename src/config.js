// config.js
/**
 * Default configuration properties for each supported NODE_ENV value
 *
 * These can be overridden via the Hindsight constructor parameters
 *
 * NOTE: when configurations are derived, each config property is shallow copied
 */

export const defaultConfig = {
  instanceLimits: {
    maxSize: 5 * 1000, // 5k instances
    maxAge: 70 * 1000 // 70 second LRU idle timeout
  },
  lineLimits: {
    maxAge: 70 * 1000, // 70 seconds
    maxBytes: 0, // unlimited
    maxCount: 100 * 1000 // 1 M lines, NOTE: a ring buffer is used, so this must have a limit
  },
  logger: console,
  writeWhen: { level: 'info' }
}

// caller param overrides env config, shallow clones 2 properties deep
export function getConfig (caller = {}, env = process.env.NODE_ENV) {
  const envConfig = envConfigs[env] || envConfigs.production
  const config = {
    logger: caller.logger || envConfig.logger,
    instanceLimits: { ...envConfig.instanceLimits, ...caller?.instanceLimits },
    lineLimits: { ...envConfig.lineLimits, ...caller?.lineLimits },
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
      maxCount: 10
    },
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
      maxCount: 10
    },
    writeWhen: { level: 'info' }
  },
  stress: {
    ...defaultConfig,
    instanceLimits: {
      maxAge: 70 * 1000,
      maxSize: 10 * 1000
    },
    lineLimits: {
      maxAge: 80 * 1000, // extended retention period
      maxBytes: 0, // unlimited
      maxCount: 500 * 1000
    },
    writeWhen: { level: 'error' }
  },
  production: {
    ...defaultConfig
  }
}

import { expect } from 'chai'
import { getConfig } from '../config.js'
import Hindsight from '../index.js'

// max values to be used as module default config values, caller can override
const MAX_LINE_COUNT_LIMIT = 10 * 1000 * 1000 // 10 million
const MAX_AGE_MS_LIMIT = 1000 * 60 * 60 * 24 * 30 // 30 days
const MAX_BYTE_LIMIT = 1000 * 1000 * 1000 // 1 GB

// Define required limits and requirements for *default* env config values
const EXPECTED_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error']

describe('Environment configuration validation tests', function () {
  const environments = ['test', 'development', 'stress', 'production']

  environments.forEach((env) => {
    describe(`${env} environment`, function () {
      let config

      before(() => {
        config = getConfig({}, env)
      })

      it('should have all required fields', function () {
        expect(config).to.have.all.keys('instanceLimits', 'lineLimits', 'logger', 'moduleLogLevel', 'writeWhen')
      })

      it('should have a valid logger', function () {
        expect(config.logger).to.satisfy(logger => logger === console || typeof logger === 'object')
        expect(config.logger).to.include.keys(EXPECTED_LOG_LEVELS)
      })

      it('should have a valid module log level', function () {
        expect(config.moduleLogLevel).to.be.oneOf(EXPECTED_LOG_LEVELS)
      })

      it('should have valid write level', function () {
        expect(config).to.have.nested.property('writeWhen.level')
        expect(config.writeWhen.level).to.be.oneOf(EXPECTED_LOG_LEVELS)
      })

      it('should have valid lineLimits settings', function () {
        expect(config).to.have.nested.property('lineLimits.maxSize')
          .to.be.a('number').that.is.at.least(2)
          .and.is.at.most(MAX_LINE_COUNT_LIMIT)
        expect(config).to.have.nested.property('lineLimits.maxAge')
          .to.be.a('number').that.is.at.least(2)
          .and.is.at.most(MAX_AGE_MS_LIMIT)
        expect(config).to.have.nested.property('lineLimits.maxBytes')
          .to.be.a('number').that.is.at.least(2)
          .and.is.at.most(MAX_BYTE_LIMIT)
      })

      it('should override default values with manually specified config values', function () {
        const customConfig = {
          instanceLimits: { maxSize: 100, maxAge: 200, maxBytes: 10 * 1024 },
          lineLimits: { maxSize: 300, maxAge: 400, maxBytes: 99 * 1000 }
        }
        const overriddenConfig = getConfig(customConfig, env)

        expect(overriddenConfig.instanceLimits.maxSize).to.equal(customConfig.instanceLimits.maxSize)
        expect(overriddenConfig.instanceLimits.maxAge).to.equal(customConfig.instanceLimits.maxAge)
        expect(overriddenConfig.lineLimits.maxSize).to.equal(customConfig.lineLimits.maxSize)
        expect(overriddenConfig.lineLimits.maxAge).to.equal(customConfig.lineLimits.maxAge)
        expect(overriddenConfig.lineLimits.maxBytes).to.equal(customConfig.lineLimits.maxBytes)
      })

      it('should not throw errors when creating new Hindsight objects with various config values', function () {
        const customConfig = {
          instanceLimits: { maxSize: 100, maxAge: 200 },
          lineLimits: { maxSize: 300, maxAge: 400 }
        }

        expect(() => new Hindsight(customConfig)).to.not.throw()
      })

      // Test with partial custom values
      it('should correctly merge partial custom values', function () {
        let customConfig = getConfig({ writeWhen: { level: 'warn' } }, env)
        expect(customConfig.writeWhen.level).to.equal('warn')
        // other values is still the default
        expect(customConfig.lineLimits.maxSize).to.equal(config.lineLimits.maxSize)

        customConfig = getConfig({ lineLimits: { maxSize: 300 } }, env)
        expect(customConfig.lineLimits).to.deep.equal({
          maxSize: 300,
          maxAge: config.lineLimits.maxAge,
          maxBytes: config.lineLimits.maxBytes
        })
        expect(customConfig.writeWhen.level).to.equal(config.writeWhen.level)
      })
    })
  })
})

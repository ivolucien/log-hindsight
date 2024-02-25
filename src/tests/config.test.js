import { expect } from 'chai'
import { getConfig } from '../config.js'
import Hindsight from '../index.js'

const MAX_LINE_COUNT_LIMIT = 1000 * 1000 * 1000 // 1 billion
const MAX_AGE_MS_LIMIT = 1000 * 60 * 60 * 24 * 30 // 30 days

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
        expect(config).to.have.all.keys('instanceLimits', 'logger', 'moduleLogLevel', 'rules')
      })

      it('should have a valid logger', function () {
        expect(config.logger).to.satisfy(logger => logger === console || typeof logger === 'object')
        expect(config.logger).to.include.keys(EXPECTED_LOG_LEVELS)
      })

      it('should have a valid module log level', function () {
        expect(config.moduleLogLevel).to.be.oneOf(EXPECTED_LOG_LEVELS)
      })

      it('should have valid write level in rules', function () {
        expect(config).to.have.nested.property('rules.write.level')
        expect(config.rules.write.level).to.be.oneOf(EXPECTED_LOG_LEVELS)
      })

      it('should have valid lineLimits settings in rules', function () {
        expect(config).to.have.nested.property('rules.lineLimits.maxSize')
          .to.be.a('number').that.is.at.least(2)
          .and.is.at.most(MAX_LINE_COUNT_LIMIT)
        expect(config).to.have.nested.property('rules.lineLimits.maxAge')
          .to.be.a('number').that.is.at.least(2)
          .and.is.at.most(MAX_AGE_MS_LIMIT)
      })

      it('should override default values with manually specified config values', function () {
        const customConfig = {
          instanceLimits: { maxSize: 100, maxAge: 200 },
          rules: { lineLimits: { maxSize: 300, maxAge: 400 } }
        }
        const overriddenConfig = getConfig(customConfig, env)

        expect(overriddenConfig.instanceLimits.maxSize).to.equal(customConfig.instanceLimits.maxSize)
        expect(overriddenConfig.instanceLimits.maxAge).to.equal(customConfig.instanceLimits.maxAge)
        expect(overriddenConfig.rules.lineLimits.maxSize).to.equal(customConfig.rules.lineLimits.maxSize)
        expect(overriddenConfig.rules.lineLimits.maxAge).to.equal(customConfig.rules.lineLimits.maxAge)
      })

      it('should not throw errors when creating new Hindsight objects with various config values', function () {
        const customConfig = {
          instanceLimits: { maxSize: 100, maxAge: 200 },
          rules: { lineLimits: { maxSize: 300, maxAge: 400 } }
        }

        expect(() => new Hindsight(customConfig)).to.not.throw()
      })

      // Test with partial custom values
      it('should correctly merge partial custom values', function () {
        let customConfig = getConfig({ rules: { write: { level: 'warn' } } }, env)
        expect(customConfig.rules.write.level).to.equal('warn')
        // other values is still the default
        expect(customConfig.rules.lineLimits.maxSize).to.equal(config.rules.lineLimits.maxSize)

        customConfig = getConfig({ rules: { lineLimits: { maxSize: 300 } } }, env)
        expect(customConfig.rules.lineLimits).to.deep.equal({
          maxSize: 300,
          maxAge: config.rules.lineLimits.maxAge,
          maxBytes: config.rules.lineLimits.maxBytes
        })
        expect(customConfig.rules.write.level).to.equal(config.rules.write.level)
      })
    })
  })
})

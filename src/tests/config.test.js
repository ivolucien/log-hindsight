import { expect } from 'chai';
import { getConfig, envConfigs } from '../config.js';

// Define required limits and requirements for *default* env config values
const EXPECTED_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'];
const MAX_LINE_COUNT_LIMIT = 1000 * 1000 * 1000;
const MAX_AGE_MS_LIMIT = 200000;

describe('Configuration Tests', function() {
  Object.keys(envConfigs).forEach(env => {
    describe(`Environment: ${env}`, function() {
      let config;

      before(() => {
        config = getConfig({}, env);
      });

      it('should have all required fields', function() {
        expect(config).to.have.all.keys('instanceLimits', 'logger', 'moduleLogLevel', 'rules', 'proxyOverride');
      });

      it('should have a valid logger', function() {
        expect(config.logger).to.satisfy(logger => logger === console || typeof logger === 'object');
        expect(config.logger).to.include.keys(EXPECTED_LOG_LEVELS);
      });

      it('should have a valid module log level', function() {
        expect(config.moduleLogLevel).to.be.oneOf(EXPECTED_LOG_LEVELS);
      });

      it('should have valid write level in rules', function() {
        expect(config).to.have.nested.property('rules.write.level');
        expect(config.rules.write.level).to.be.oneOf(EXPECTED_LOG_LEVELS);
      });

      it('should have valid lineLimits settings in rules', function() {
        expect(config).to.have.nested.property('rules.lineLimits.maxSize')
          .to.be.a('number').that.is.at.least(2)
          .and.is.at.most(MAX_LINE_COUNT_LIMIT);
        expect(config).to.have.nested.property('rules.lineLimits.maxAge')
          .to.be.a('number').that.is.at.least(2)
          .and.is.at.most(MAX_AGE_MS_LIMIT);
      });

      // Test with partial custom values
      it('should correctly merge partial custom values', function() {
        const customConfig = getConfig({ rules: { write: { level: 'warn' } } }, env);
        expect(customConfig.rules.write.level).to.equal('warn');
        // other values is still the default
        expect(customConfig.rules.lineLimits.maxSize).to.equal(config.rules.lineLimits.maxSize);
      });
    });
  });
});

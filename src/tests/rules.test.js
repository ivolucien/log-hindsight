import { expect } from 'chai';
import Hindsight from '../index.js';
import { getConfig } from '../config.js';
import LogTableManager from '../log-tables.js';

describe('Hindsight Rules Tests', function() {
  let envConfig;

  before(() => {
    envConfig = getConfig();
  });

  it('should set the default rule for a Hindsight instance correctly', function() {
    const hindsight = new Hindsight();
    const { rules: expectedRules } = envConfig; // get defaults for the current NODE_ENV

    expect(hindsight.rules).to.eql(expectedRules);
  });

  it('should overwrite default write rule when provided', function() {
    const customRules = { write: { level: 'error' } };
    const hindsight = new Hindsight({ rules: customRules });
    expect(hindsight.rules.write).to.eql(customRules.write);
  });

  it('should overwrite default lineLimits rules when provided', function() {
    const customRules = {
      lineLimits: {
        maxCount: 5000,
        maxAgeMs: 60000
      }
    };
    const hindsight = new Hindsight({ rules: customRules });
    expect(hindsight.rules.lineLimits).to.eql(customRules.lineLimits);
  });

  it('should overwrite subsest of default rules, keeping default for unspecified rules', function() {
    const customRules = {
      lineLimits: { maxCount: 5000 }
    };
    const hindsight = new Hindsight({ rules: customRules });
    expect(hindsight.rules.lineLimits.maxCount).to.eql(customRules.lineLimits.maxCount); // modified
    expect(hindsight.rules.write).to.eql(envConfig.rules.write); // default
    expect(hindsight.rules.lineLimits.maxAgeMs).to.eql(envConfig.rules.lineLimits.maxAgeMs); // default
  });

  it('should limit the total number of log lines stored based on lineLimits.maxCount setting', function() {
    const customRules = {
      lineLimits: {
        maxCount: 3, // Assuming we want to keep only 3 log lines
      }
    };
    LogTableManager.initGlobalIndex(customRules.lineLimits.maxCount); // reset static line index
    const hindsight = new Hindsight({ rules: customRules });

    // Simulate logging to store lines
    hindsight.debug('First line');
    hindsight.debug('Second line');
    hindsight.debug('Third line');
    hindsight.debug('Fourth line'); // This should trigger limits

    // Assuming hindsight object has a method to get the current log lines count
    expect(hindsight.logTables.sequenceIndex.size()).to.equal(customRules.lineLimits.maxCount);
  });

  it('should remove log lines older than lineLimits.maxAgeMs setting', function(done) {
    const customRules = {
      lineLimits: {
        maxAgeMs: 100 // Lines older than 100ms should be removed
      }
    };
    const hindsight = new Hindsight({ rules: customRules });

    hindsight.debug('Old line');

    // Wait for more than 1000ms then log another line
    setTimeout(() => {
      hindsight.debug('New line');
      hindsight.applyLineLimits(); // normally these are async, but we want to test immediately

      // Assuming hindsight object has a method to get log lines with their timestamps
      const linesRemaining = hindsight.logTables.sequenceIndex.size();
      const line = hindsight.logTables.sequenceIndex.peek();
      const currentTime = Date.now();

      // Validate that no log lines are older than the current time minus maxAgeMs
      expect(linesRemaining).to.equal(1);
      const msSinceSecondLine = currentTime - line.context.timestamp;
      expect(msSinceSecondLine).to.be.below(customRules.lineLimits.maxAgeMs);

      done();
    }, 150); // Wait enough time to ensure the old line is older than maxAgeMs
  });
});

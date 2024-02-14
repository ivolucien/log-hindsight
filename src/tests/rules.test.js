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
        maxAge: 60000,
        maxBytes: 1000,
        maxSize: 5000,
      }
    };
    const hindsight = new Hindsight({ rules: customRules });
    expect(hindsight.rules.lineLimits).to.eql(customRules.lineLimits);
  });

  it('should overwrite subsest of default rules, keeping default for unspecified rules', function() {
    const customRules = {
      lineLimits: { maxSize: 5000 }
    };
    const hindsight = new Hindsight({ rules: customRules });
    expect(hindsight.rules.lineLimits.maxSize).to.eql(customRules.lineLimits.maxSize); // modified
    expect(hindsight.rules.write).to.eql(envConfig.rules.write); // default
    expect(hindsight.rules.lineLimits.maxAge).to.eql(envConfig.rules.lineLimits.maxAge); // default
  });

  it('should limit the total number of log lines stored based on lineLimits.maxSize setting', function() {
    const customRules = {
      lineLimits: {
        maxSize: 3, // Assuming we want to keep only 3 log lines
      }
    };
    LogTableManager.initGlobalIndex(customRules.lineLimits.maxSize); // reset static line index
    const hindsight = new Hindsight({ rules: customRules });

    // Simulate logging to store lines
    hindsight.debug('First line');
    hindsight.debug('Second line');
    hindsight.debug('Third line');
    hindsight.debug('Fourth line'); // This should trigger limits

    // Assuming hindsight object has a method to get the current log lines count
    expect(hindsight.logTables.sequenceIndex.size()).to.equal(customRules.lineLimits.maxSize);
  });

  it('should remove log lines older than lineLimits.maxAge setting', function(done) {
    const customRules = {
      lineLimits: {
        maxAge: 100 // Lines older than 100ms should be removed
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

      // Validate that no log lines are older than the current time minus maxAge
      expect(linesRemaining).to.equal(1);
      const msSinceSecondLine = currentTime - line.context.timestamp;
      expect(msSinceSecondLine).to.be.below(customRules.lineLimits.maxAge);

      done();
    }, 150); // Wait enough time to ensure the old line is older than maxAge
  });

  it('should remove log lines when maxBytes limit is exceeded', function() {
    const customConfig = {
      rules: {
        lineLimits: {
          maxBytes: 500, // Set a low byte limit for testing
        }
      }
    };

    hindsight = new Hindsight(customConfig);
    // Generate log lines that collectively exceed the maxBytes limit
    for (let i = 0; i < 10; i++) {
      hindsight.debug(`Log line ${i} with some additional content to increase size.`);
    }

    // Apply line limits based on the current configuration
    hindsight.applyLineLimits();

    // Assert that the total estimated bytes of stored log lines is less than or equal to maxBytes
    expect(hindsight.logTables.extimatedBytes).to.be.at.most(customConfig.rules.lineLimits.maxBytes);

    // Assert that some log lines have been removed to respect the maxBytes limit
    const totalLines = Object.values(hindsight.logTables.logTables).reduce((acc, table) => acc + Object.keys(table).length - 1, 0); // -1 for each table's counter property
    expect(totalLines).to.be.lessThan(10); // Less than 10 since some lines should have been removed
  });
});

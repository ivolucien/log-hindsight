import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight Rules Tests', function() {
  it('should set the default rule for a Hindsight instance correctly', function() {
    const hindsight = new Hindsight();
    expect(hindsight.rules).to.eql({
      write: { level: 'info' },
      trim: {
        lineCountAbove: 10 * 1000,
        lineOlderThanMs: 70 * 1000
      }
    });
  });

  it('should overwrite default write rule when provided', function() {
    const customRules = { write: { level: 'error' } };
    const hindsight = new Hindsight({ rules: customRules });
    expect(hindsight.rules.write).to.eql(customRules.write);
  });

  it('should overwrite default trim rules when provided', function() {
    const customRules = {
      trim: {
        lineCountAbove: 5000,
        lineOlderThanMs: 60000
      }
    };
    const hindsight = new Hindsight({ rules: customRules });
    expect(hindsight.rules.trim).to.eql(customRules.trim);
  });

  it('should limit the total number of log lines stored based on trim.lineCountAbove setting', function() {
    const customRules = {
      trim: {
        lineCountAbove: 3, // Assuming we want to keep only 3 log lines
      }
    };
    const hindsight = new Hindsight({ rules: customRules });

    // Simulate logging to store lines
    hindsight.debug('First line');
    hindsight.debug('Second line');
    hindsight.debug('Third line');
    hindsight.debug('Fourth line'); // This should trigger trimming

    // Assuming hindsight object has a method to get the current log lines count
    expect(hindsight.logTables.indices.sequence.size()).to.equal(customRules.trim.lineCountAbove);
  });

  it('should remove log lines older than trim.lineOlderThanMs setting', function(done) {
    const customRules = {
      trim: {
        lineOlderThanMs: 100 // Lines older than 100ms should be removed
      }
    };
    const hindsight = new Hindsight({ rules: customRules });

    hindsight.debug('Old line');

    // Wait for more than 1000ms then log another line
    setTimeout(() => {
      hindsight.debug('New line');
      hindsight.applyTrimRules(); // normally these are async, but we want to test immediately

      // Assuming hindsight object has a method to get log lines with their timestamps
      const linesRemaining = hindsight.logTables.indices.sequence.size();
      const line = hindsight.logTables.indices.sequence.peek();
      const currentTime = Date.now();

      // Validate that no log lines are older than the current time minus lineOlderThanMs
      expect(linesRemaining).to.equal(1);
      const msSinceSecondLine = currentTime - line.context.timestamp;
      expect(msSinceSecondLine).to.be.below(customRules.trim.lineOlderThanMs);

      done();
    }, 150); // Wait enough time to ensure the old line is older than lineOlderThanMs
  });
});

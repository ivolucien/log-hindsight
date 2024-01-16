import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight applyTrimRules Tests', function() {
  let hindsight;

  beforeEach(function() {
    // Setup Hindsight with custom trim rules for testing
    const customRules = {
      trim: {
        lineCountAbove: 5,
        lineOlderThanMs: 50 // 50 milliseconds
      }
    };
    hindsight = new Hindsight({ rules: customRules });
  });

  it('should trim log lines above the specified count', function() {
    // Add log lines that fall below the immediate write level and exceed the max line count
    for (let i = 0; i < 7; i++) {
      hindsight._logIntake({ name: 'debug', sessionId: 'test', timestamp: Date.now() }, `Log line ${i}`);
    }

    // Check if the number of log lines are trimmed to 5
    const logTable = hindsight._getTable('debug', 'test');
    const expectedLogTableKeys = hindsight.rules.trim.lineCountAbove + 1; // +1 for the counter key
    hindsight._debug({ logTable, tableKeys: Object.keys(logTable) });
    expect(Object.keys(logTable).length).to.be.at.most(expectedLogTableKeys);
  });

  it('should remove log lines older than specified milliseconds', function(done) {
    // Add a log line that will be older than 50ms
    hindsight._logIntake({ name: 'debug', sessionId: 'test', timestamp: Date.now() - 100 }, 'Old log line');

    // Add a recent log line
    hindsight._logIntake({ name: 'debug', sessionId: 'test', timestamp: Date.now() }, 'New log line');

    // Wait for 10ms and then apply trim rules
    setTimeout(() => {
      hindsight.applyTrimRules();
      const logTable = hindsight._getTable('debug', 'test');

      // Check if the old log line is removed
      expect(logTable.counter).to.equal(3); // 2 log lines and has been incremented afterwards
      expect(logTable[1]).to.not.exist;
      expect(logTable[2]).to.haveOwnProperty('payload').that.eqls(['New log line']);
      done();
    }, 10);
  });

  it('should correctly choose immediate or deferred write based on custom write rule', function() {
    const customRules = { write: { level: 'warn' } }; // Only warn and above are written immediately
    const hindsight = new Hindsight({ rules: customRules });

    hindsight._logIntake({ name: 'info', sessionId: 'test' }, 'Deferred log line');
    hindsight._logIntake({ name: 'warn', sessionId: 'test' }, 'Immediate log line');;

    const infoTable = hindsight._getTable('info', 'test');
    const warnTable = hindsight._getTable('warn', 'test');

    hindsight._debug({ sequenceIndex: hindsight.logIndices.sequence._elements });
    expect(infoTable['1']).to.exist; // 'info' is below 'warn', so it should be deferred
    expect(warnTable['1']).to.not.exist; // 'warn' is at or above 'warn', so it should be written immediately
  });
});

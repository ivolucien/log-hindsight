// src/tests/console-proxy.test.js
import chai from 'chai';
import spies from 'chai-spies';
chai.use(spies);
const { expect } = chai;

import Hindsight from '../index.js';
import ConsoleProxy from '../console-proxy.js';

describe('Hindsight Console Log Proxy Tests', function() {
  let hindsight;
  const testMessage = 'Test message';

  beforeEach(function() {
    hindsight = new Hindsight({ rules: { write: { level: 'error' } } });
  });

  it('should create a new Hindsight instance with the default logger', function() {
    expect(hindsight.moduleName).to.equal('console');
    expect(hindsight.module).to.equal(console);
    expect(hindsight.rules.write).to.eql({ level: 'error' });
    expect(hindsight.proxy).to.equal(ConsoleProxy);
  });

  it('should have a proxy method for each of the logger output methods', function() {
    const logIntakeSpy = chai.spy.on(hindsight, '_logIntake');
    let count = 0;

    hindsight.logMethods.forEach((method) => {
      expect(hindsight[method.name]).to.be.a('function');

      hindsight[method.name](testMessage);
      count++;
      expect(logIntakeSpy).to.have.been.called().exactly(count);
    });
  });

  it('should create a new Hindsight instance with the default logger', function() {
    expect(hindsight.moduleName).to.equal('console');
    expect(hindsight.module).to.equal(console);
    expect(hindsight.rules.write).to.eql({ level: 'error' });
    expect(hindsight.proxy).to.equal(ConsoleProxy);
  });

  it('should respect the default log level write rule', function() {
    hindsight.info(testMessage); // Should not be logged
    expect(hindsight.info.writeCounter).to.equal(0);
    hindsight.warn(testMessage); // Should not be logged
    expect(hindsight.warn.writeCounter).to.equal(0);

    hindsight.error(testMessage); // Should be logged
    expect(hindsight.error.writeCounter).to.equal(1);
  });

  it('should respect the custom write rule log level', function() {
    const hindsight2 = new Hindsight({ rules: { write: { level: 'trace' } } });

    hindsight2.trace.writeCounter = 0;
    hindsight2.trace('Intentional trace output with stack');
    expect(hindsight2.trace.writeCounter).to.equal(1);

    hindsight2.error.writeCounter = 0;
    hindsight2.error(testMessage);
    hindsight2.error('2');
    hindsight2.error(3);

    expect(hindsight2.error.writeCounter).to.equal(3);
  });

  afterEach(function() {
    hindsight.trace.writeCounter = 0;
    hindsight.error.writeCounter = 0;
  });
});

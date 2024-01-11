// src/tests/log-proxy.js
import chai from 'chai';
import spies from 'chai-spies';
chai.use(spies);
const { expect } = chai;

import Hindsight from '../index.js';
import ConsoleProxy from '../console-proxy.js';

describe('Hindsight Console Log Proxy Tests', function() {
  let hindsight = new Hindsight({ rules: { write: { level: 'error' } } });

  it('should create a new Hindsight instance with default options', function() {
    expect(hindsight.moduleName).to.equal('console');
    expect(hindsight.module).to.equal(console);
    expect(hindsight.rules).to.eql({ write: { level: 'error' } });
    expect(hindsight.proxy).to.equal(ConsoleProxy);
  });

  it('should have a proxy method for each of the logger output methods', function() {
    const logIntakeSpy = chai.spy.on(hindsight, '_logIntake');
    let count = 0;

    hindsight.logMethods.forEach((method) => {
      expect(hindsight[method.name]).to.be.a('function');

      hindsight[method.name]('Test message');
      count++;
      expect(logIntakeSpy).to.have.been.called().exactly(count);
    });
  });
  // does chai-spies have something like: logIntakeSpy.restore()
});

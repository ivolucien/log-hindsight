import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight child tests', function() {
  let originalHindsight, newLogger;

  beforeEach(function() {
    originalHindsight = new Hindsight();
    newLogger = originalHindsight.child({ perLineFields: { key: 'value' }});
  });

  it('should create a new logger with default options as a proxied console', function() {
    expect(originalHindsight.moduleName).to.equal('console');
    expect(newLogger.moduleName).to.equal('console');
  });

  it('should create a new logger with properties matching the original', function() {
    expect(newLogger.module).to.equal(console);
    expect(newLogger.proxy).to.equal(originalHindsight.proxy);
    expect(newLogger.logMethods).to.deep.equal(originalHindsight.logMethods);
    newLogger.proxy.logTableNames.forEach((name) => {
      expect(newLogger.logTables.get(name)).to.deep.equal({ counter: 1 });
    });
  });

  it('should create a new logger with a unique instanceId and functional log methods', function() {
    expect(newLogger.instanceId).to.not.equal(originalHindsight.instanceId);

    newLogger.logMethods.forEach((method) => {
      expect(newLogger[method.name]).to.be.a('function');
      expect(newLogger.logTables.get(method.name)).to.be.an('object');
    });
  });

  it('should create a child with specific perLineFields', function() {
    const perLineFields = { key: 'value' };
    const childLogger = originalHindsight.child({ perLineFields });

    expect(childLogger).to.be.instanceOf(Hindsight);
    expect(childLogger.perLineFields).to.deep.eql(perLineFields);
  });

  it('should create a child with combined rules', function() {
    const customRules = { write: { level: 'error' } };
    const childLogger = originalHindsight.child({ rules: customRules });

    expect(childLogger.rules.write.level).to.equal('error');
  });

  describe('Hindsight getOrCreateChild Tests', function() {
    it('should return the same instance for the same perLineFields', function() {
      const perLineFields = { key: 'value' };
      const child1 = Hindsight.getOrCreateChild(perLineFields, originalHindsight);
      const child2 = Hindsight.getOrCreateChild(perLineFields, originalHindsight);

      expect(child1).to.equal(child2); // WIP - test breaks here on instanceId, wassup?
    });

    it('should return different instances for different perLineFields', function() {
      const child1 = Hindsight.getOrCreateChild({ key: 'value1' }, originalHindsight);
      const child2 = Hindsight.getOrCreateChild({ key: 'value2' }, originalHindsight);

      expect(child1).to.not.equal(child2);
    });
  });
});

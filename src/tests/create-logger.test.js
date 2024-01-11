import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight createLogger Tests', function() {
  let originalHindsight, newLogger;

  beforeEach(function() {
    originalHindsight = new Hindsight();
    newLogger = originalHindsight.createLogger();
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
      const expectedSessionEntry = { [newLogger.instanceId]: { counter: 1} };
      expect(newLogger.logTables[name]).to.deep.equal(expectedSessionEntry);
    });
  });

  it('should create a new logger with a unique instanceId and functional log methods', function() {
    expect(newLogger.instanceId).to.not.equal(originalHindsight.instanceId);

    newLogger.logMethods.forEach((method) => {
      expect(newLogger[method.name]).to.be.a('function');
      expect(newLogger.logTables[method.name]).to.be.an('object');
    });
  });
});

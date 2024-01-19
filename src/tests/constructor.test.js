import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight Constructor Tests', function() {
  const FakeLogger = {
    fake: true,
    logTableNames: ['info'],
    levelIntHash: { info: 30, 30: 30 },
    getLogMethods: () => [{ name: 'info', level: 30 }],
    info() { console.error('FakeLogger info() called') },
  };

  function validateConstructor(logger, proxyOverride) {
    const instance = new Hindsight({ logger, proxyOverride });
    expect(instance).to.be.instanceOf(Hindsight);
    expect(instance.module).to.equal(logger || console);

    instance.logMethods.forEach((method) => {
      expect(instance[method.name]).to.be.a('function');
      expect(instance.logTables.get(method.name)).to.be.an('object');
    });
    return instance;
  }

  it('should depend on default constructor values', function() {
    const obj = validateConstructor();
    expect(obj.moduleName).to.equal('console');
  });

  it('should explicitly use console when passed', function() {
    const obj = validateConstructor(console);
    expect(obj.moduleName).to.equal('console');
  });

  it('should use a custom logger module when a proxy is passed in', function() {
    const obj = validateConstructor(FakeLogger, {
      stub: true,
      logTableNames: ['info'],
      levelIntHash: { info: 30, 30: 30 },
      getLogMethods: () => [{ name: 'info', level: 30 }],
    });
    expect(obj.moduleName).to.equal('unknown');
    expect(obj.module).to.haveOwnProperty('fake');
    expect(obj.proxy).to.haveOwnProperty('stub');
  });

  it('should throw an error for an unknown logger without a custom proxy', function() {
    try {
      const obj = validateConstructor(FakeLogger);
      expect.fail('Constructor should throw an error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
    }
  });
});

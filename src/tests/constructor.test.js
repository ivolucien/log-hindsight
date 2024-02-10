import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight Constructor Tests', function() {
  // this function incidentally verifies that falsey caller values don't override defaults
  function validateConstructor(logger) {
    const instance = new Hindsight({ logger });
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
    expect(obj.module).to.equal(console);
  });

  it('should explicitly use console when passed', function() {
    const obj = validateConstructor(console);
    expect(obj.module).to.equal(console);
  });
});

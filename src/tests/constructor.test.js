import { expect } from 'chai';
import Hindsight from '../index.js';

// todo: consider adding either zora (minimal) or AVA (lightweight) test runner
console.log("\nconstructor tests...");

function validateConstructor(logger, testProxy) {
  const instance = new Hindsight(logger, testProxy);
  expect(instance).to.be.instanceOf(Hindsight);
  expect(instance.module).to.equal(logger || console);
  // check proxy log methods
  instance.logMethods.forEach((method) => {
    expect(instance[method.name]).to.be.a('function');
    expect(instance.logTables[method.name]).to.be.an('object');
  });
  return instance;
}

console.log('depend on default constructor values');
let obj = validateConstructor();
expect(obj.name).to.equal('console');


console.log('explicitly pass console');
obj = validateConstructor(console);
expect(obj.name).to.equal('console');

console.log('uses custom logger module when proxy is passed in');
const FakeLogger = {
  fake: true,
  getLogTableNames() { return ['info']; },
  getLogMethods() { return [{ name: 'info', level: 30 }]; },
  info() { console.error('FakeLogger info() called') },
}
obj = validateConstructor(FakeLogger, {
  // custom proxy
  stub: true,
  getLogTableNames() { return ['info']; },
  getLogMethods() { return [{ name: 'info', level: 30 }]; },
});
expect(obj.name).to.equal('unknown')
expect(obj.module).to.haveOwnProperty('fake');

// used specified custom proxy
expect(obj.proxy).to.haveOwnProperty('stub');

console.log('unknown logger without custom proxy fails');
try {
  obj = validateConstructor(FakeLogger);
  expect('to fail').to.equal('to never get here');
} catch (err) {
  // constructor should throw error since no proxy is available
  console.log(err.message)
  expect(err).to.be.instanceOf(Error);
}

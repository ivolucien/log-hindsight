import { expect } from 'chai';
import Hindsight from '../index.js';

// todo: consider adding either zora (minimal) or AVA (lightweight) test runner
console.log("/nconstructor tests...");

console.log('depend on default constructor values');
let obj = new Hindsight();
expect(obj).to.be.instanceOf(Hindsight);
expect(obj.name).to.equal('console');
expect(obj.module).to.equal(console);

console.log('explicitly pass console');
obj = new Hindsight(console);
expect(obj).to.be.instanceOf(Hindsight);
expect(obj.name).to.equal('console');
expect(obj.module).to.equal(console);

console.log('uses specified logger module');
const FakeLogger = {
  fake: true,
  getLogTableNames() { return ['info']; },
  info() { console.error('FakeLogger info() called') },
}
obj = new Hindsight(FakeLogger, {
  // custom proxy
  stub: true,
  getLogTableNames() { return ['info']; },
});
expect(obj.name).to.equal('unknown')
expect(obj.module).to.equal(FakeLogger);
expect(obj.module).to.haveOwnProperty('fake');
expect(obj.module.info()).to.not.throw;

console.log('uses specified custom proxy');
expect(obj.proxy).to.haveOwnProperty('stub');

console.log('unknown logger without custom proxy fails');
try {
  obj = new Hindsight(FakeLogger);
  expect('to fail').to.equal('to never get here');
} catch (err) {
  console.log(err.message)
  expect(err).to.be.instanceOf(Error);
}

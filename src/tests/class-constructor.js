import { expect } from 'chai'
import Hindsight from '../index.js'

console.log('constructor tests...');

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
  info() { console.error('FakeLogger info() called') },
}
obj = new Hindsight(FakeLogger, {
  stub: true,
  getQueueNames() { return []; },
});
expect(obj.name).to.equal('unknown')
expect(obj.module).to.equal(FakeLogger);
expect(obj.module).to.haveOwnProperty('fake');
expect(obj.module.info()).to.not.throw;

console.log('uses specified proxy');
expect(obj.proxy).to.haveOwnProperty('stub');

console.log('unknown logger without custom proxy fails');
try {
  obj = new Hindsight(FakeLogger);
  expect('to fail').to.equal('to never get here');
} catch (err) {
  expect(err).to.be.instanceOf(Error);
}
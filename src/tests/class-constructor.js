import { expect } from 'chai'
import Hindsight from '../index.js'

console.log('constructor tests...');

// depend on default constructor values
let obj = new Hindsight();
expect(obj).to.be.instanceOf(Hindsight);
expect(obj.name).to.equal('console');
expect(obj.module).to.equal(console);

// explicitly pass console
obj = new Hindsight({ console });
expect(obj).to.be.instanceOf(Hindsight);
expect(obj.name).to.equal('console');
expect(obj.module).to.equal(console);

// uses specified logger module
const FakeLogger = {
  fake: true,
  info() { console.error('FakeLogger info() called') },
}
obj = new Hindsight({ FakeLogger }, {
  stub: true,
  getQueueNames() { return []; },
});
expect(obj.name).to.equal('FakeLogger')
expect(obj.module).to.equal(FakeLogger);
expect(obj.module).to.haveOwnProperty('fake');
expect(obj.module.info()).to.not.throw;

// uses specified proxy, not default
expect(obj.proxy).to.haveOwnProperty('stub');

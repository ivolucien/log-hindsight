import { expect } from 'chai';
// Import the Hindsight class from src/index.js
import Hindsight from '../index.js';

console.log("\ngetter tests...");

console.log('instanceId getter returns the correct value');
const hindsight = new Hindsight({});
expect(hindsight.instanceId).to.equal('id0'); // format is 'id' + instanceId
try { hindsight.instanceId = 'test'; } // should not be able to set instanceId
catch (e) { }
expect(hindsight.instanceId).to.equal('id0');

console.log('getTable returns the correct log table');
hindsight.proxy.logTableNames.forEach((name) => {
  const sessionId = hindsight.instanceId;
  const expectedSessionEntry = {}[sessionId] = { counter: 1};
  expect(hindsight.getTable(name)).to.deep.eql(expectedSessionEntry);
});
const hindsight2 = new Hindsight();
expect(hindsight2.instanceId).to.equal('id1');

console.log('getLoggerName returns the correct logger name');
import { expect } from 'chai';
import Hindsight from '../index.js';

console.log("\ncreateLogger tests...");

// hindsight with all default options creates a proxied console
let obj = new Hindsight({});
expect(obj.name).to.equal('console');

let logger = obj.createLogger();
expect(logger.name).to.equal('console');
expect(logger.module).to.equal(console);
expect(logger.proxy).to.equal(obj.proxy);
expect(logger.logMethods).to.deep.equal(obj.logMethods);
expect(logger.logTables).to.deep.equal(obj.logTables);
expect(logger.instanceId).to.not.equal(obj.instanceId);

logger.logMethods.forEach((method) => {
  expect(logger[method.name]).to.be.a('function');
  expect(logger.logTables[method.name]).to.be.an('object');
});
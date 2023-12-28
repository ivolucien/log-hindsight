import { expect } from 'chai'
import Hindsight from '../index.js'
import util from 'util';

console.log("\ncreateLogger tests...");

// hindsight with all default options creates a proxied console
let obj = new Hindsight();
expect(obj.name).to.equal('console');

let logger = obj.createLogger();
expect(util.types.isProxy(logger)).to.be.true;


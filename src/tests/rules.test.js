import { expect } from 'chai';
// Import the Hindsight class from src/index.js
import Hindsight from '../index.js';

console.log("\nrules tests...");

console.log('default rule for hindsight instance is set correctly');
const hindsight = new Hindsight();
expect(hindsight.rules).to.eql({ write: { level: 'info' } });

import { expect } from 'chai';
// Import the Hindsight class from src/index.js
import Hindsight from '../index.js';

// Create a new instance of the Hindsight class
const hindsight = new Hindsight();

console.log("Check if metadata and payload are added correctly to logTables");
const test1Metadata = { sessionId: '123456', name: 'info' };
const test1Payload = { message: 'Test log message' };
hindsight.log(test1Metadata, test1Payload);

const test1Table = hindsight.logTables[test1Metadata.name];
expect(test1Table[test1Metadata.sessionId]).to.be.an('object');
const test1Session = test1Table[test1Metadata.sessionId];

const test1LogLine = test1Session[1];
expect(test1LogLine).to.haveOwnProperty('context');
expect(test1LogLine.context).to.haveOwnProperty('timestamp');

delete test1LogLine.context.timestamp;
expect(test1LogLine).to.deep.eql({
  context: { sessionId: '123456', sequence: 1 },
  payload: [{ message: 'Test log message' }]
});

/*
// Test 2: Check if metadata.name defaults to 'info' if not provided
const test2Payload = { sessionId: '123456', message: 'Test log message' };
hindsight.log({}, test2Payload);
expect(hindsight.logTables['info'][test2Payload.sessionId]).to.equal({
  ...test2Payload,
  context: {}
});

// Test 3: Check the contents of the resulting object in logTables
const test3Metadata = { name: 'error' };
const test3Payload = { sessionId: '123456', message: 'Test log message' };
hindsight.log(test3Metadata, test3Payload);
expect(hindsight.logTables[test3Metadata.name][test3Payload.sessionId]).to.equal({
  ...test3Payload,
  context: test3Metadata
});
*/
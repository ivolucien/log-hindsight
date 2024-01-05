import { expect } from 'chai';
// Import the Hindsight class from src/index.js
import Hindsight from '../index.js';

function setupLogTest(metadata, ...payload) {
  const hindsight = new Hindsight();
  hindsight.log(metadata, ...payload);
  return hindsight;
}

function expectValidLogTable(hsInstance, tableName) {
  expect(hsInstance.logTables).to.haveOwnProperty(tableName);
  expect(hsInstance.logTables[tableName]).to.be.an('object');
  return hsInstance.logTables[tableName];
}
function expectValidLogLine(logTable, expectedData) {
  const sessionId = expectedData.context.sessionId;
  expect(logTable).to.haveOwnProperty(sessionId);

  const logLine = logTable[sessionId][expectedData.context.sequence];
  expect(logLine.context.timestamp).to.be.a('number');
  const { timestamp, ...staticData } = logLine.context;
  if (expectedData.context.timestamp) {
    expect(timestamp).to.equal(expectedData.context.timestamp);
    delete expectedData.context.timestamp;
  }
  expect(staticData).to.deep.eql(expectedData.context);
  expect(logLine.payload).to.deep.eql(expectedData.payload);
}

console.log('Typical metadata and payload are added correctly to logTables');
let hindsight = setupLogTest(
  { sessionId: '123456', name: 'trace' },
  { message: 'Test log message' }
);

let testTable = expectValidLogTable(hindsight, 'trace');
expectValidLogLine(testTable, {
    context: { sessionId: '123456', sequence: 1 },
    payload: [{ message: 'Test log message' }]  
});

console.log('Multiple payload args are added correctly to logTables');
hindsight = setupLogTest(
  { sessionId: '123456', name: 'trace' },
  [],
  "testing",
  { message: 'Test log message' }
);

testTable = expectValidLogTable(hindsight, 'trace');
expectValidLogLine(testTable, {
    context: { sessionId: '123456', sequence: 1 },
    payload: [[], "testing", { message: 'Test log message' }]
});

console.log('Default context values are used when no metadata is provided');
hindsight = setupLogTest({}, { message: 'Test log message' });

testTable = expectValidLogTable(hindsight, 'info');
expectValidLogLine(testTable, {
    context: { sessionId: hindsight.instanceId, sequence: 1 },
    payload: [{ message: 'Test log message' }]  
});

console.log('Specific timestamp provided is used');
const then = Date.now() - 1000;
hindsight = setupLogTest({ timestamp: then }, { message: 'Test log message' });

testTable = expectValidLogTable(hindsight, 'info');
expectValidLogLine(testTable, {
    context: { timestamp: then, sessionId: hindsight.instanceId, sequence: 1 },
    payload: [{ message: 'Test log message' }]  
});

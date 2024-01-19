import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight logIntake Tests', function() {
  function setupLogTest(metadata, ...payload) {
    const hindsight = new Hindsight({});
    hindsight._logIntake(metadata, ...payload);
    return hindsight;
  }

  function expectValidLogTable(hsInstance, tableName) {
    expect(hsInstance.logTables.get(tableName)).to.be.an('object');
    return hsInstance.logTables.get(tableName);
  }

  function expectValidLogLine(logTable, expectedData) {
    const logLine = logTable[expectedData.context.sequence];
    expect(logLine.context.timestamp).to.be.a('number');
    if (expectedData.context.timestamp) {
      expect(logLine.context.timestamp).to.equal(expectedData.context.timestamp);
    }
    expect(logLine.payload).to.deep.eql(expectedData.payload);
  }

  it('should add typical metadata and payload correctly to logTables', function() {
    const hindsight = setupLogTest(
      { sessionId: '123456', name: 'debug' },
      { message: 'Test log message' }
    );

    const testTable = expectValidLogTable(hindsight, 'debug');
    expectValidLogLine(testTable, {
      context: { sessionId: '123456', sequence: 1 },
      payload: [{ message: 'Test log message' }]
    });
  });

  it('should add multiple payload arguments correctly to logTables', function() {
    const hindsight = setupLogTest(
      { sessionId: '123456', name: 'trace' },
      [],
      "testing",
      { message: 'Test log message' }
    );

    const testTable = expectValidLogTable(hindsight, 'trace');
    expectValidLogLine(testTable, {
      context: { sessionId: '123456', sequence: 1 },
      payload: [[], "testing", { message: 'Test log message' }]
    });
  });

  it('should use default context values when no metadata is provided', function() {
    const hindsight = setupLogTest({ name: 'debug' }, { message: 'Test log message' });

    const testTable = expectValidLogTable(hindsight, 'debug');
    expectValidLogLine(testTable, {
      context: { sessionId: hindsight.instanceId, sequence: 1 },
      payload: [{ message: 'Test log message' }]
    });
  });

  it('should use a specific timestamp when provided', function() {
    const then = Date.now() - 1000;
    const hindsight = setupLogTest({ name: 'debug', timestamp: then }, { message: 'Test log message' });
    hindsight._dir(hindsight.logTables.get('debug')[hindsight.instanceId]);

    const testTable = expectValidLogTable(hindsight, 'debug');
    expectValidLogLine(testTable, {
      context: { timestamp: then, sessionId: hindsight.instanceId, sequence: 1 },
      payload: [{ message: 'Test log message' }]
    });
  });
});

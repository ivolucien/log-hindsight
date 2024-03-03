import { expect } from 'chai'
import Hindsight from '../index.js'

describe('Hindsight logIntake Tests', function () {
  function setupLogTest (metadata, ...payload) {
    const hindsight = new Hindsight({})
    hindsight._logIntake(metadata, ...payload)
    return hindsight
  }

  function expectValidLogBuffer (hsInstance, bufferName) {
    expect(hsInstance.buffers.get(bufferName)).to.be.an('object')
    return hsInstance.buffers.get(bufferName)
  }

  function expectValidLogLine (logBuffer, expectedData) {
    const logLine = logBuffer[expectedData.context.sequence]
    expect(logLine.context.timestamp).to.be.a('number')
    if (expectedData.context.timestamp) {
      expect(logLine.context.timestamp).to.equal(expectedData.context.timestamp)
    }
    expect(logLine.payload).to.deep.eql(expectedData.payload)
  }

  it('should add typical metadata and payload correctly to buffers', function () {
    const hindsight = setupLogTest(
      { sessionId: '123456', name: 'debug' },
      { message: 'Test log message' }
    )

    const testBuffer = expectValidLogBuffer(hindsight, 'debug')
    expectValidLogLine(testBuffer, {
      context: { sessionId: '123456', sequence: 1 },
      payload: [{ message: 'Test log message' }]
    })
  })

  it('should add multiple payload arguments correctly to buffers', function () {
    const hindsight = setupLogTest(
      { sessionId: '123456', name: 'trace' },
      [],
      'testing',
      { message: 'Test log message' }
    )

    const testBuffer = expectValidLogBuffer(hindsight, 'trace')
    expectValidLogLine(testBuffer, {
      context: { sessionId: '123456', sequence: 1 },
      payload: [[], 'testing', { message: 'Test log message' }]
    })
  })

  it('should use default context values when no metadata is provided', function () {
    const hindsight = setupLogTest({ name: 'debug' }, { message: 'Test log message' })

    const testBuffer = expectValidLogBuffer(hindsight, 'debug')
    expectValidLogLine(testBuffer, {
      context: { sequence: 1 },
      payload: [{ message: 'Test log message' }]
    })
  })

  it('should use a specific timestamp when provided', function () {
    const then = Date.now() - 1000
    const hindsight = setupLogTest({ name: 'debug', timestamp: then }, { message: 'Test log message' })
    hindsight._debug(hindsight.buffers.get('debug'))

    const testBuffer = expectValidLogBuffer(hindsight, 'debug')
    expectValidLogLine(testBuffer, {
      context: { timestamp: then, sequence: 1 },
      payload: [{ message: 'Test log message' }]
    })
  })
})

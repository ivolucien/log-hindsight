import { expect } from 'chai'
import Hindsight from '../index.js'
import getScopedLoggers from '../internal-loggers.js'

import winston from 'winston'
import bunyan from 'bunyan'
import pino from 'pino'

const { trace } = getScopedLoggers('tests')

describe('Hindsight perLineFields handling tests', function () {
  let hindsight

  afterEach(function () {
    hindsight = undefined
  })

  function expectValidLogBuffer (hsInstance, bufferName) {
    expect(hsInstance.buffers.get(bufferName)).to.be.an('object')
    return hsInstance.buffers.get(bufferName)
  }

  function expectValidLogLine (logBuffer, expectedData, expectedPerLineFields) {
    const logLine = logBuffer.get(expectedData.context.sequence)

    expect(logLine.context.timestamp).to.be.a('number')
    if (expectedData.context.timestamp) {
      expect(logLine.context.timestamp).to.equal(expectedData.context.timestamp)
    }
    expect(logLine.payload).to.deep.include.members(expectedData.payload)

    if (expectedPerLineFields) {
      const decoratedPayload = hindsight._addPerLineFields(logLine.payload) // what would be written
      // per line fields are kept in the instance, they aren't copied to the line payload unless written
      trace(expectedPerLineFields, 'actual:', decoratedPayload)
      expect(decoratedPayload).to.deep.include(expectedPerLineFields)
      expect(decoratedPayload).to.include(hindsight.perLineFields)
    }
  }

  it('should include perLineFields in the final payload', async function () {
    const perLineFields = { userId: 'user123', sessionId: 'session456' }
    hindsight = new Hindsight({ writeWhen: { level: 'info' }, perLineFields })
    hindsight._logIntake(
      { name: 'trace' },
      ['User action log']
    )

    const testBuffer = expectValidLogBuffer(hindsight, 'trace')
    expect(testBuffer.size).to.equal(1)
    expectValidLogLine(testBuffer, {
      context: { sequence: 0 },
      payload: ['User action log'],
      perLineFields
    })
  })

  it('should applly perLineFields to multiple log lines', function () {
    const perLineFields = { userId: 'user789', sessionId: 'session101' }
    hindsight = new Hindsight({ writeWhen: { level: 'warn' }, perLineFields })

    hindsight._logIntake({ name: 'debug' }, ['First log message'])
    hindsight._logIntake({ name: 'info' }, ['Info log message'])

    const debugBuffer = expectValidLogBuffer(hindsight, 'debug')
    const infoBuffer = expectValidLogBuffer(hindsight, 'info')

    expectValidLogLine(debugBuffer, {
      context: { sequence: 0 },
      payload: ['First log message'],
      perLineFields
    })

    expectValidLogLine(infoBuffer, {
      context: { sequence: 0 },
      payload: ['Info log message'],
      perLineFields
    })
  })

  it('should allow child loggers to inherit and extend parent perLineFields', function () {
    const parentPerLineFields = { userId: 'userABC' }
    const childPerLineFields = { sessionId: 'sessionXYZ' }
    const parentHindsight = new Hindsight({ perLineFields: parentPerLineFields })
    hindsight = parentHindsight.child({ perLineFields: childPerLineFields })

    hindsight._logIntake({ name: 'trace' }, ['Child logger message'])

    const testBuffer = expectValidLogBuffer(hindsight, 'trace')
    expectValidLogLine(testBuffer, {
      context: { sequence: 0 },
      payload: ['Child logger message'],
      perLineFields: { ...parentPerLineFields, ...childPerLineFields }
    })
  })

  it('should use child perLineFields property value if also defined on parent', function () {
    const parentPerLineFields = { userId: 'userABC', sessionId: 'session123' }
    const childPerLineFields = { sessionId: 'sessionXYZ' }
    const parentHindsight = new Hindsight({ perLineFields: parentPerLineFields })
    hindsight = parentHindsight.child({ perLineFields: childPerLineFields })

    hindsight.trace('Another child logger message')

    const testBuffer = expectValidLogBuffer(hindsight, 'trace')
    expectValidLogLine(testBuffer, {
      context: { sequence: 0 },
      payload: ['Another child logger message'],
      perLineFields: { ...parentPerLineFields, sessionId: 'sessionXYZ' }
    })
  })

  describe('when passed the logger module itself', function () {
    const perLineFields = { userId: 'user123', sessionId: 'session456', name: 'moduleTest' }

    it('should store and retrieve perLineFields for console', function () {
      hindsight = new Hindsight({ logger: console, writeWhen: { level: 'info' }, perLineFields })

      expect(hindsight.adapter.perLineFields).to.deep.eql(perLineFields)
    })

    it('should pass through the perLineFields to winston instance', function () {
      hindsight = new Hindsight({ logger: winston, writeWhen: { level: 'info' }, perLineFields })

      expect(hindsight.adapter.perLineFields).to.equal(perLineFields)
    })

    it('should pass through the perLineFields to bunyan instance', function () {
      hindsight = new Hindsight({ logger: bunyan, writeWhen: { level: 'info' }, perLineFields })

      expect(hindsight.adapter.perLineFields).to.include(perLineFields)
    })

    it('should pass through the perLineFields to pino instance', function () {
      hindsight = new Hindsight({ logger: pino, writeWhen: { level: 'info' }, perLineFields })

      expect(hindsight.adapter.perLineFields).to.eql(perLineFields)
    })
  })

  describe('when passed logger instance and separate fields property', function () {
    const perLineFields = { userId: 'user123', sessionId: 'session456', name: 'moduleTest' }

    // leaving out test for console since it has no concept of instances

    it('should pass through the perLineFields to winston instance', function () {
      const logger = winston.createLogger({ defaultMeta: perLineFields })
      hindsight = new Hindsight({ logger, writeWhen: { level: 'info' }, perLineFields })

      expect(hindsight.adapter.perLineFields).to.equal(perLineFields)
    })

    it('should pass through the perLineFields to bunyan instance', function () {
      const logger = bunyan(perLineFields)
      const { name, ...sansName } = perLineFields
      hindsight = new Hindsight({ logger, writeWhen: { level: 'info' }, perLineFields: sansName })

      expect(hindsight.adapter.perLineFields).to.include(perLineFields)
    })

    it('should pass through the perLineFields to pino instance', function () {
      const logger = pino()
      hindsight = new Hindsight({ logger, writeWhen: { level: 'info' }, perLineFields })
      console.log({ winston: winston.levels, pino: logger.pino, bunyan: bunyan.levels, console: console.lablels })

      expect(hindsight.adapter.perLineFields).to.eql(perLineFields)
    })
  })
})

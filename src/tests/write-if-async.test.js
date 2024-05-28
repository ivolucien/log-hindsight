import chai from 'chai'
import chaiSpies from 'chai-spies'
import { setTimeout } from 'timers/promises'

import Hindsight from '../index.js'
import LevelBuffers from '../level-buffers.js'
import getScopedLoggers from '../internal-loggers.js'
const { trace } = getScopedLoggers('hindsight')

const expect = chai.expect
chai.use(chaiSpies)

// NOTE: Set (static)) buffer line count by calling LevelBuffers.initGlobalLineTracking in beforeEach

// wait for a condition function to return truthy, max of
async function waitForCondition (condition, intervalMs = 20) {
  let maxWaits = 50
  while (!condition() && maxWaits-- > 0) {
    await setTimeout(intervalMs)
  }
}

describe('Hindsight writeIf method tests', function () {
  let hindsight
  let operationOrder = []
  let mockLogger

  beforeEach(function () {
    mockLogger = {
      info: chai.spy(),
      debug: chai.spy(),
      error: chai.spy(),
      warn: chai.spy()
    }
    hindsight = new Hindsight({
      logger: mockLogger,
      lineLimits: { maxAge: 1000, maxCount: 100 },
      writeWhen: { level: 'error' }
    })
    operationOrder = []
  })

  it('mutex orders writeIf ', async function () {
    const lockSpy = chai.spy.on(hindsight.buffersMutex, 'runExclusive')

    // Mock the function that's supposed to acquire the lock
    async function mockAsyncOperation ({ context, payload }) {
      const testNumber = payload[0][payload[0].length - 1]
      operationOrder.push('start ' + testNumber)
      await setTimeout(1) // Simulate some async work
      operationOrder.push('end ' + testNumber)
      return true // signal the line should be written
    }

    // Call writeIf repeatedly, is concurrent async execution handled in sequence?
    hindsight.debug('Starting test, line 1')
    hindsight.debug('Starting test, line 2')
    hindsight.debug('Starting test, line 3')
    hindsight.writeIf('debug', mockAsyncOperation) // one of these should process the first 3 lines
    hindsight.writeIf('debug', mockAsyncOperation) // the rest wait, then process nothing
    hindsight.writeIf('debug', mockAsyncOperation)
    hindsight.debug('Starting test, line 4')
    hindsight.writeIf('debug', mockAsyncOperation) // this should process the last line

    // Wait for both operations to complete
    await setTimeout(100)

    // Check that the mutex's runExclusive method was called twice
    expect(lockSpy).to.have.been.called.exactly(4)

    // Check that operations were executed sequentially, not in parallel
    expect(operationOrder).to.deep.equal([
      'start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3', 'start 4', 'end 4'
    ])
  })

  it('line sorting', async function () {
    // Simulate logging at different times
    await setTimeout(10) // Ensure there's a small delay
    hindsight.warn('Warning line')
    await setTimeout(10) // Further delay
    hindsight.debug('Debugging info')
    await setTimeout(10) // Additional delay
    hindsight.info('Informational log')

    // call writeIf to process the buffered log lines
    await hindsight.writeIf('debug') // Write all logs since level is debug or higher

    // Wait a bit to ensure all async operations are complete
    await setTimeout(100)

    // Verify the order of the calls by checking the call order in the spy
    const calls = [...mockLogger.warn.__spy.calls, ...mockLogger.debug.__spy.calls, ...mockLogger.info.__spy.calls]
    calls.sort((a, b) => a.calledAt - b.calledAt) // Sort by the time they were called
    console.dir(calls)
    expect(calls[0]).to.deep.equal(['Warning line'])
    expect(calls[1]).to.deep.equal(['Debugging info'])
    expect(calls[2]).to.deep.equal(['Informational log'])
  })

  describe('batch processing', function () {
    let batchYieldSpy
    const batchTestLines = 21

    beforeEach(function () {
      LevelBuffers.initGlobalLineTracking(batchTestLines + 10)
      hindsight.batchSize = 10
      // Spy on the batchYield method to verify it's called during batch processing
      batchYieldSpy = chai.spy.on(hindsight, '_batchYield')
    })

    it('event loop yield', async function () {
      // Simulate adding a large number of log lines to trigger batch processing
      for (let i = 0; i < batchTestLines; i++) {
        hindsight.debug(`Log message ${i}`)
      }
      hindsight.debug('last line')

      // Trigger writeIf to process the buffered log lines
      hindsight.writeIf('debug')
      console.dir({ batchYieldSpy: batchYieldSpy.__spy })
      await setTimeout(200) // wait for batchYield to be called at least twice
      // Verify that batchYield was called to allow event loop yielding
      // The exact number of times batchYield is called depends on the batchSize and the number of log lines
      // For simplicity, we're just checking that it was called
      expect(batchYieldSpy).to.have.been.called
    })

    afterEach(function () {
      // Reset any spies or mocked functions
      chai.spy.restore()
    })
  })

  it('error handling in async flow', async function () {
    console.log('The following ERROR is INTENTIONAL, testing error handling')
    const errorSpy = chai.spy.on(console, 'error')
    mockLogger.info = () => {
      console.trace('INFO called')
      throw new Error('Write failed')
    }
    hindsight._logIntake({ name: 'info' }, ['Info log'])
    await new Promise((resolve) => {
      // Trigger writeIf to process the buffered log lines
      hindsight.writeIf('debug', ({ payload }) => {
        if (payload[0] === 'Info log') {
          resolve()
        }
        return true
      })
    }).catch((e) => {
      console.log('CATCH', e)
    })

    expect(errorSpy).to.have.been.called
  })

  it('filtering with writeLineNow', async function () {
    // Given several log entries with distinct phrases to ensure accurate filtering
    hindsight.info('write this entry')
    hindsight.warn('Warning: foo')
    hindsight.debug('baz details') // 3 log lines, waits for 3rd to resolve below

    // writeIf processes in the background after the function itself returns, wait for resolve()
    let count = 0
    const writeLineNowSpy = chai.spy()
    // only write log line containing 'write this entry'
    async function writeLineNow ({ payload }) {
      writeLineNowSpy()
      const toWrite = payload[0].includes('write this entry')
      trace('COUNT', ++count)
      return toWrite
    }

    // Trigger writeIf to process the buffered log lines
    trace('writeIf called', { totalLineCount: hindsight.totalLineCount })
    hindsight.writeIf('debug', writeLineNow)

    await waitForCondition(() => hindsight.info.writeCounter > 0) // wait for line to be written

    // Then only the 'info' log that meets the condition is written
    expect(mockLogger.info).to.have.been.called.once
    expect(mockLogger.debug).to.not.have.been.called
    expect(mockLogger.warn).to.not.have.been.called
    expect(writeLineNowSpy).to.have.been.called.exactly(3) // Ensure decision function was invoked for each log
  })
})

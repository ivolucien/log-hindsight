import { expect } from 'chai'
import Hindsight from '../index.js'
import LevelBuffers from '../level-buffers.js'

describe('Hindsight applyLineLimits.Rules Tests', function () {
  let hindsight

  beforeEach(function () {
    // Setup Hindsight with custom limit rules for testing
    const lineLimits = {
      maxSize: 5,
      maxAge: 50 // 50 milliseconds
    }
    LevelBuffers.initGlobalLineTracking(lineLimits.maxSize) // reset static line index
    hindsight = new Hindsight({ lineLimits })
    hindsight.buffers.sequenceIndex.deqN(hindsight.buffers.sequenceIndex.size()) // Clear line index
  })

  it('should limit log lines above the specified count', function () {
    // Add log lines that fall below the immediate write level and exceed the max line count
    for (let i = 0; i < 7; i++) {
      hindsight._logIntake({ name: 'debug', sessionId: 'test', timestamp: Date.now() }, `Log line ${i}`)
    }

    // Check if the number of log lines are limited to 5
    const buffer = hindsight.buffers.get('debug')
    const expectedBufferKeys = hindsight.lineLimits.maxSize + 1 // +1 for the counter key
    hindsight._debug({ buffer, bufferKeys: Object.keys(buffer) })
    expect(Object.keys(buffer).length).to.be.at.most(expectedBufferKeys)
  })

  it('should remove log lines older than specified milliseconds', function (done) {
    // Add a log line that will be older than 50ms
    hindsight._logIntake({ name: 'debug', sessionId: 'test', timestamp: Date.now() - 100 }, 'Old log line')

    // Add a recent log line
    hindsight._logIntake({ name: 'debug', sessionId: 'test', timestamp: Date.now() }, 'New log line')

    // Wait for 10ms and then apply lineLimits rules
    setTimeout(() => {
      hindsight.applyLineLimits()
      const buffer = hindsight.buffers.get('debug', 'test')

      // Check if the old log line is removed
      expect(buffer.counter).to.equal(3) // 2 log lines and has been incremented afterwards
      expect(buffer[1]).to.not.exist
      expect(buffer[2]).to.haveOwnProperty('payload').that.eqls(['New log line'])
      done()
    }, 10)
  })

  it('should correctly choose immediate or deferred write based on custom write rule', function () {
    const customRules = { write: { level: 'warn' } } // Only warn and above are written immediately
    const hindsight = new Hindsight({ rules: customRules })

    hindsight._logIntake({ name: 'info', sessionId: 'test' }, 'Deferred log line')
    hindsight._logIntake({ name: 'warn', sessionId: 'test' }, 'Immediate log line')

    const infoBuffer = hindsight.buffers.get('info', 'test')
    const warnBuffer = hindsight.buffers.get('warn', 'test')

    hindsight._debug({ sequenceIndexSize: hindsight.buffers.sequenceIndex.size() })
    expect(infoBuffer['1']).to.exist // 'info' is below 'warn', so it should be deferred
    expect(warnBuffer['1']).to.not.exist // 'warn' is at or above 'warn', so it should be written immediately
  })
})

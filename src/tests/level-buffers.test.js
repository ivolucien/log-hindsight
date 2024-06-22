import { expect } from 'chai'
import Hindsight from '../index.js'
import ObjectCache from '../object-cache.js'
import { getConfig } from '../config.js'
import LevelBuffers from '../level-buffers.js'

describe('Hindsight level buffers', function () {
  const envConfig = getConfig()

  beforeEach(() => {
    const { lineLimits } = getConfig()
    ObjectCache.initSingletonTracking()
    LevelBuffers.initGlobalLineTracking(lineLimits.maxCount) // reset static line index
  })

  it('should overwrite default write rule when provided', function () {
    const customConfig = { writeWhen: { level: 'error' } }
    const hindsight = new Hindsight(customConfig)
    expect(hindsight.writeWhen).to.eql(customConfig.writeWhen)
  })

  it('should overwrite default lineLimits when provided', function () {
    const lineLimits = {
      maxAge: 60000,
      maxCount: 5000
    }
    LevelBuffers.initGlobalLineTracking(lineLimits.maxCount) // reset static line index

    const hindsight = new Hindsight({ lineLimits })
    expect(hindsight.buffers.lineLimits).to.eql(lineLimits)
  })

  it('should overwrite subset of default limits, keeping default for unspecified limits', function () {
    const lineLimits = {
      maxCount: 5000
    }
    LevelBuffers.initGlobalLineTracking(lineLimits.maxCount) // reset static line index

    const hindsight = new Hindsight({ lineLimits })
    console.log(hindsight.buffers.lineLimits)
    expect(hindsight.buffers.lineLimits.maxAge).to.eql(envConfig.lineLimits.maxAge) // default
    expect(hindsight.buffers.lineLimits.maxCount).to.eql(lineLimits.maxCount) // modified

    expect(hindsight.writeWhen).to.eql(envConfig.writeWhen) // default
  })

  it('should only log messages that meet or exceed the configured log level', async function () {
    const printed = []
    const store = (msg) => printed.push(msg)
    const stub = { debug: store, info: store, warn: store, error: store }
    const customConfig = {
      logger: stub,
      writeWhen: { level: 'warn' } // Only log warnings or above
    }
    const hindsight = new Hindsight(customConfig)

    hindsight.debug('debug message should be buffered.')
    hindsight.info('info message should be buffered.')
    hindsight.warn('warning message should be logged.')
    hindsight.error('error message should be logged.')

    // Assuming Hindsight or LevelBuffers has a method to retrieve all logged messages
    const linesRingBuffer = hindsight.buffers.GlobalLineRingbuffer
    const loggedMessages = linesRingBuffer.peekN(linesRingBuffer.size()).map(line => line.payload[0])

    expect(loggedMessages).to.have.lengthOf(2) // only those below log level are buffered
    expect(loggedMessages.some((msg) => msg.includes('debug'))).to.be.true
    expect(loggedMessages.some((msg) => msg.includes('info'))).to.be.true

    expect(printed).to.have.lengthOf(2) // only those at or above log level are printed
    expect(printed.some((msg) => msg.includes('warn'))).to.be.true
    expect(printed.some((msg) => msg.includes('error'))).to.be.true
  })

  it('should log at error level if fatal error logged on console', async function () {
    const printed = []
    const store = (msg) => printed.push(msg)
    const stub = { debug: store, info: store, warn: store, error: store }
    const customConfig = { logger: stub }
    const hindsight = new Hindsight(customConfig)

    hindsight.error('error message should be logged.')
    hindsight.fatal('fatal message should be logged.')

    const errorBuffer = hindsight.buffers.getOrCreate('error')
    expect(errorBuffer[0]).to.not.exist // printed, not buffered

    const fatalBuffer = hindsight.buffers.getOrCreate('fatal')
    expect(fatalBuffer[0]).to.not.exist // printed, not buffered

    expect(printed).to.have.lengthOf(2)
    expect(printed.some((msg) => msg.includes('error'))).to.be.true
    expect(printed.some((msg) => msg.includes('fatal'))).to.be.true
  })

  it('should limit the total number of log lines stored based on lineLimits.maxCount setting', function () {
    const maxCount = 3
    const lineLimits = { maxCount }

    const customConfig = getConfig({ lineLimits })
    expect(customConfig.lineLimits.maxCount).to.equal(maxCount)

    LevelBuffers.initGlobalLineTracking(maxCount) // reset static line index

    const hindsight = new Hindsight(customConfig)
    expect(LevelBuffers.totalLineCount).to.equal(0)
    expect(hindsight.buffers.GlobalLineRingbuffer.capacity()).to.equal(maxCount)

    // Simulate logging to store lines
    hindsight.debug('First line')
    hindsight.debug('Second line')
    hindsight.debug('Third line')
    hindsight.debug('Fourth line') // This should trigger limits

    // Assuming hindsight object has a method to get the current log lines count
    expect(LevelBuffers.totalLineCount).to.equal(maxCount)
  })

  it('should remove log lines older than lineLimits.maxAge setting', function (done) {
    const lineLimits = {
      maxAge: 100 // Lines older than 100ms should be removed
    }
    const hindsight = new Hindsight({ lineLimits })

    hindsight.debug('Old line')

    // Wait for more than 1000ms then log another line
    setTimeout(() => {
      hindsight.debug('New line')
      hindsight.applyLineLimits() // normally these are async, but we want to test immediately

      const linesRemaining = LevelBuffers.totalLineCount
      const line = hindsight.buffers.GlobalLineRingbuffer.peek()
      const currentTime = Date.now()

      // Validate that no log lines are older than the current time minus maxAge
      expect(linesRemaining).to.equal(1)
      const msSinceSecondLine = currentTime - line.context.timestamp
      expect(msSinceSecondLine).to.be.below(lineLimits.maxAge)

      done()
    }, 150) // Wait enough time to ensure the old line is older than maxAge
  })
})

import { expect } from 'chai'
import Hindsight from '../index.js'
import { getConfig } from '../config.js'
import LogTableManager from '../log-tables.js'

describe('Hindsight Rules Tests', function () {
  const envConfig = getConfig()
  const customConfig = {
    rules: {
      lineLimits: {
        maxBytes: 500 // Set a low byte limit for testing
      }
    }
  }

  beforeEach(() => {
    const { rules: { lineLimits } } = getConfig(customConfig)
    Hindsight.initSingletonTracking()
    LogTableManager.initGlobalLineTracking(lineLimits.maxSize) // reset static line index
  })

  it('should set the default rule for a Hindsight instance correctly', function () {
    const hindsight = new Hindsight()
    const { rules: expectedRules } = envConfig // get defaults for the current NODE_ENV

    expect(hindsight.rules).to.eql(expectedRules)
  })

  it('should overwrite default write rule when provided', function () {
    const customRules = { write: { level: 'error' } }
    const hindsight = new Hindsight({ rules: customRules })
    expect(hindsight.rules.write).to.eql(customRules.write)
  })

  it('should overwrite default lineLimits rules when provided', function () {
    const customRules = {
      lineLimits: {
        maxAge: 60000,
        maxBytes: 1000,
        maxSize: 5000
      }
    }
    const hindsight = new Hindsight({ rules: customRules })
    expect(hindsight.rules.lineLimits).to.eql(customRules.lineLimits)
  })

  it('should overwrite subsest of default rules, keeping default for unspecified rules', function () {
    const customRules = {
      lineLimits: { maxSize: 5000 }
    }
    const hindsight = new Hindsight({ rules: customRules })
    expect(hindsight.rules.lineLimits.maxSize).to.eql(customRules.lineLimits.maxSize) // modified
    expect(hindsight.rules.write).to.eql(envConfig.rules.write) // default
    expect(hindsight.rules.lineLimits.maxAge).to.eql(envConfig.rules.lineLimits.maxAge) // default
  })

  it('should only log messages that meet or exceed the configured log level', async function () {
    const printed = []
    const store = (msg) => printed.push(msg)
    const stub = { debug: store, info: store, warn: store, error: store }
    const customConfig = {
      logger: stub,
      rules: {
        write: { level: 'warn' } // Only log warnings or above
      }
    }
    const hindsight = new Hindsight(customConfig)

    hindsight.debug('debug message should be buffered.')
    hindsight.info('info message should be buffered.')
    hindsight.warn('warning message should be logged.')
    hindsight.error('error message should be logged.')

    // Assuming Hindsight or LogTableManager has a method to retrieve all logged messages
    const linesRingBuffer = hindsight.logTables.sequenceIndex
    const loggedMessages = linesRingBuffer.peekN(linesRingBuffer.size()).map(line => line.payload[0])

    expect(loggedMessages).to.have.lengthOf(2) // only those below log level are buffered
    expect(loggedMessages.some(([msg]) => msg.includes('debug'))).to.be.true
    expect(loggedMessages.some(([msg]) => msg.includes('info'))).to.be.true

    expect(printed).to.have.lengthOf(2) // only those at or above log level are printed
    expect(printed.some(([msg]) => msg.includes('warn'))).to.be.true
    expect(printed.some(([msg]) => msg.includes('error'))).to.be.true
  })

  it('should log at error level if fatal error logged on console', async function () {
    const printed = []
    const store = (msg) => printed.push(msg)
    const stub = { debug: store, info: store, warn: store, error: store }
    const customConfig = { logger: stub}
    const hindsight = new Hindsight(customConfig)

    hindsight.error('error message should be logged.')
    hindsight.fatal('fatal message should be logged.')

    const errorTable = hindsight.logTables.get('error')
    expect(errorTable[0]).to.not.exist // printed, not buffered

    const fatalTable = hindsight.logTables.get('fatal')
    expect(fatalTable[0]).to.not.exist // printed, not buffered

    expect(printed).to.have.lengthOf(2)
    expect(printed.some(([msg]) => msg.includes('error'))).to.be.true
    expect(printed.some(([msg]) => msg.includes('fatal'))).to.be.true
  })

  it('should limit the total number of log lines stored based on lineLimits.maxSize setting', function () {
    const maxSize = 3
    const customRules = {
      lineLimits: { maxSize }
    }
    const customConfig = getConfig({ rules: customRules })
    expect(customConfig.rules.lineLimits.maxSize).to.equal(maxSize)

    LogTableManager.initGlobalLineTracking(maxSize) // reset static line index

    const hindsight = new Hindsight(customConfig)
    expect(hindsight.logTables.sequenceIndex.size()).to.equal(0)
    expect(hindsight.logTables.sequenceIndex.capacity()).to.equal(maxSize)

    // Simulate logging to store lines
    hindsight.debug('First line')
    hindsight.debug('Second line')
    hindsight.debug('Third line')
    hindsight.debug('Fourth line') // This should trigger limits

    // Assuming hindsight object has a method to get the current log lines count
    expect(hindsight.logTables.sequenceIndex.size()).to.equal(maxSize)
  })

  it('should remove log lines older than lineLimits.maxAge setting', function (done) {
    const customRules = {
      lineLimits: {
        maxAge: 100 // Lines older than 100ms should be removed
      }
    }
    const hindsight = new Hindsight({ rules: customRules })

    hindsight.debug('Old line')

    // Wait for more than 1000ms then log another line
    setTimeout(() => {
      hindsight.debug('New line')
      hindsight.applyLineLimits() // normally these are async, but we want to test immediately

      // Assuming hindsight object has a method to get log lines with their timestamps
      const linesRemaining = hindsight.logTables.sequenceIndex.size()
      const line = hindsight.logTables.sequenceIndex.peek()
      const currentTime = Date.now()

      // Validate that no log lines are older than the current time minus maxAge
      expect(linesRemaining).to.equal(1)
      const msSinceSecondLine = currentTime - line.context.timestamp
      expect(msSinceSecondLine).to.be.below(customRules.lineLimits.maxAge)

      done()
    }, 150) // Wait enough time to ensure the old line is older than maxAge
  })

  it('should remove log lines when maxBytes limit is exceeded', function () {
    const hindsight = new Hindsight(customConfig)

    expect(LogTableManager.estimatedBytes).to.equal(0)
    expect(hindsight.logTables.maxBytes).to.equal(customConfig.rules.lineLimits.maxBytes)

    // Generate log lines that collectively exceed the maxBytes limit
    for (let i = 0; i < 10; i++) {
      hindsight.debug(`Log line ${i} with sixty filler chars to increase line size.`)
    }

    // Apply line limits based on the current configuration
    hindsight.applyLineLimits()

    // Assert that the total estimated bytes of stored log lines is less than or equal to maxBytes
    expect(LogTableManager.estimatedBytes).to.be.at.most(customConfig.rules.lineLimits.maxBytes)

    // Assert that some log lines have been removed to respect the maxBytes limit
    const totalLines = Object.values(hindsight.logTables.logTables).reduce((acc, table) => acc + Object.keys(table).length - 1, 0) // -1 for each table's counter property
    expect(totalLines).to.be.lessThan(10) // Less than 10 since some lines should have been removed
  })
})

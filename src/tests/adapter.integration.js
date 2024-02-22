import chai from 'chai'
import bunyan from 'bunyan'
import winston from 'winston'
import pino from 'pino'
import stream from 'stream'

import LogAdapter, { LOG_LEVELS } from '../adapter.js'
const expect = chai.expect

// Create a writable stream to capture log messages
const createCaptureStream = () => {
  const output = []
  const writable = new stream.Writable({
    write (chunk, encoding, callback) {
      output.push(chunk.toString())
      callback()
    }
  })
  writable.output = output
  return writable
}

describe('LogAdapter Integration Tests', () => {
  // Define loggers with redirected output
  const captureStream = createCaptureStream()
  const loggers = {
    bunyan: bunyan.createLogger({ name: 'test', stream: captureStream, level: 'trace' }),
    winston: winston.createLogger({
      transports: [new winston.transports.Stream({ stream: captureStream })],
      level: 'silly'
    }),
    pino: pino({ level: 'trace' }, captureStream)
  }

  Object.entries(loggers).forEach(([loggerName, logger]) => {
    describe(`${loggerName} logger`, () => {
      const adapter = new LogAdapter(logger)

      beforeEach(() => {
        captureStream.output.length = 0 // Clear captured output before each test
      })

      Object.keys(LOG_LEVELS).forEach(level => {
        it(`should log a message for ${level}`, () => {
          adapter[level]('Test message')

          // Verify that a message was captured
          expect(captureStream.output.length).to.be.greaterThan(0)
          // Further inspection of the output can be done here if necessary
        })
      })
    })
  })
})

// temporary intercept of stdout and stderr writes
function captureStdStreams (stream) {
  const originalWrite = stream.write
  const output = []

  stream.write = (chunk, encoding, callback) => {
    output.push(chunk.toString())
    originalWrite.call(stream, chunk, encoding, callback)
  }

  return {
    output,
    restore: () => { stream.write = originalWrite }
  }
}

function hasSubString (array, subString) {
  return array.some((string) => string.includes(subString))
}

describe('LogAdapter integration test with console logger', () => {
  let stdoutCapture, stderrCapture

  beforeEach(() => {
    // Start capturing stdout and stderr
    stdoutCapture = captureStdStreams(process.stdout)
    stderrCapture = captureStdStreams(process.stderr)
  })

  afterEach(() => {
    // Stop capturing and clean up
    stdoutCapture?.restore()
    stderrCapture?.restore()
  })

  const called = 'Called console.'

  it('should correctly delegate to expected log methods', () => {
    const adapter = new LogAdapter(console)

    // Test a variety of console methods
    adapter.dir(`${called}dir`)
    adapter.debug(`${called}debug`)
    adapter.log(`${called}log`)
    adapter.info(`${called}info`)
    adapter.warn(`${called}warn`)
    adapter.error(`${called}error`)

    stdoutCapture.restore()
    stderrCapture.restore()

    // dir, debug, log and info should be written to stdout
    const stdOut = stdoutCapture.output
    /* eslint-disable no-unused-expressions */ // ignore strings here
    expect(hasSubString(stdOut, `${called}dir`)).to.be.true
    expect(hasSubString(stdOut, `${called}debug`)).to.be.true
    expect(hasSubString(stdOut, `${called}log`)).to.be.true
    expect(hasSubString(stdOut, `${called}info`)).to.be.true

    // warn and error should be written to stderr
    const stdErr = stderrCapture.output
    expect(hasSubString(stdErr, `${called}warn`)).to.be.true
    expect(hasSubString(stdErr, `${called}error`)).to.be.true
    /* eslint-enable no-unused-expressions */
  })

  it('should correctly delegate to expected fallback methods', () => {
    const adapter = new LogAdapter(console)

    // Test a variety of console methods
    adapter.silly('Called console.silly')
    adapter.verbose('Called console.verbose')
    adapter.fatal('Called console.fatal')

    stdoutCapture.restore()
    stderrCapture.restore()

    // messages were written as expected
    /* eslint-disable no-unused-expressions */
    expect(hasSubString(stdoutCapture.output, `${called}silly`)).to.be.true
    expect(hasSubString(stdoutCapture.output, `${called}verbose`)).to.be.true

    expect(hasSubString(stderrCapture.output, `${called}fatal`)).to.be.true
    /* eslint-enable no-unused-expressions */
  })

  // Additional tests for other console methods and scenarios can be added here
})

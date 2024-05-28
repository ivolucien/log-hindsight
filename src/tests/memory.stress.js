import { expect } from 'chai'
import Hindsight from '../index.js'
import LevelBuffers from '../level-buffers.js'
import getScopedLoggers from '../internal-loggers.js'
const { error } = getScopedLoggers('tests')

const TimeOverride = process.env.HINDSIGHT_TEST_SPEED_MS || 1000

function printMB (bytes) { return `${Math.floor(bytes / (1000 * 1000))}MB` }

describe('Line buffer volume test', function () {
  this.beforeEach(function () {
    Hindsight.initSingletonTracking({})
  })

  after(function () {
    error('End of stress test, log level set to ' + process.env.DEBUG)
  })

  it('should just buffer info level logs, test large buffer size', async function () {
    this.timeout(60 * TimeOverride)
    const config = {
      writeWhen: { level: 'error' } // set write level to error so info logs are buffered
    }

    const hindsight = new Hindsight(config)

    const numberOfEntries = 50 * TimeOverride
    const entrySize = 10 * 1000
    const testStart = new Date()
    const maxTestTime = 58 * TimeOverride

    async function bigLines (size) {
      Promise.all(Array.from({ length: 5 }, () => hindsight.info(Buffer.alloc(entrySize))))
    }
    try {
      const start = new Date()
      for (let i = 0; i < numberOfEntries && maxTestTime > new Date() - testStart; i += 10) {
        await Promise.all([
          bigLines(),
          bigLines()
        ])

        if (i % (5 * TimeOverride) === 0) { // log occasionally
          console.log(`Test ${i}) ${Date.now() - start} ms elapsed`)
        }
      };
    } catch (error) {
      console.log('Memory error occurred:', error)
      // Optionally, log the estimated total bytes used by the log lines in the buffer
    }

    const heapUsed = process.memoryUsage().heapUsed
    console.log({ heapUsed: printMB(heapUsed), lineCount: hindsight.buffers.GlobalLineRingbuffer.size() })
  })

  it('should just buffer lots of lines and release all as they age out', async function () {
    this.timeout(60 * TimeOverride)
    const config = {
      writeWhen: { level: 'error' }, // set write level to error so info logs are buffered
      lineLimits: { maxAge: 50 * TimeOverride } // some lines age out before the test ends
    }

    const hindsight = new Hindsight(config)

    const numberOfEntries = 200 * TimeOverride
    const entrySize = 1000
    const testStart = new Date()
    const maxTestTime = 58 * TimeOverride

    async function bigLines (size) {
      return Promise.all(
        Array.from({ length: 5 }, () => hindsight.info(Buffer.alloc(entrySize)))
      )
    }
    try {
      const maxAgeWithSlack = config.lineLimits.maxAge - 100 // allow time to delete old lines
      const start = new Date()
      for (let i = 0; i < numberOfEntries && maxTestTime > new Date() - testStart; i += 10) {
        await Promise.all([
          bigLines(),
          bigLines()
        ])

        if (i % (50 * TimeOverride) === 0) { // log occasionally
          const then = hindsight.buffers.GlobalLineRingbuffer.peek().context.timestamp
          expect(then).to.be.at.most(new Date() - maxAgeWithSlack)

          console.log(i + ') Estimated buffer size:', // log occasionally
            printMB(LevelBuffers.TotalEstimatedLineBytes),
            ' ms elapsed:', new Date() - start
          )
        };
      };
    } catch (error) {
      console.log('Error during stress test:', error)
      // Optionally, log the estimated total bytes used by the log lines in the buffer
    }

    const heapUsed = process.memoryUsage().heapUsed
    console.log({ heapUsed: printMB(heapUsed), lineCount: hindsight.buffers.GlobalLineRingbuffer.size() })
  })
})

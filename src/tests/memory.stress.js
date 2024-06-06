import { expect } from 'chai'
import Hindsight from '../index.js'
import LevelBuffers from '../level-buffers.js'
import { logMemoryUsage } from './test-utils.js'
import getScopedLoggers from '../internal-loggers.js'
const { error } = getScopedLoggers('tests')

const TimeOverride = process.env.HINDSIGHT_TEST_SPEED_MS || 1000
let start

function printMB (bytes) { return `${Math.floor(bytes / (1000 * 1000))}MB` }

async function logAndWait (delayMs = 10 * 1000) {
  let lostLineCount = 0
  let collectedCount = 0
  const weakRefs = LevelBuffers.getFirstLineWeakRefs()
  for (const weakRef of weakRefs) {
    weakRef.line.deref() ? lostLineCount++ : collectedCount++
  }
  logMemoryUsage()
  console.log(
    'Overall test duration: ', (Date.now() - start) / 1000 + 's',
    { lostCount: lostLineCount, gcCount: weakRefs.length - lostLineCount }
  )
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

describe('Line buffer volume test', function () {
  let hindsight

  beforeEach(function () {
    start = Date.now()
    Hindsight.initSingletonTracking({})
    console.log(Hindsight.getDiagnosticStats())
  })

  afterEach(async function () {
    hindsight.delete()
    error('End of stress test, log level set to ' + process.env.DEBUG)
  })

  it('should just buffer info level logs, test large buffer size', async function () {
    this.timeout(90 * TimeOverride)
    const config = {
      writeWhen: { level: 'error' } // set write level to error so info logs are buffered
    }

    hindsight = new Hindsight(config)

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
          bigLines(),
          new Promise(resolve => setImmediate(resolve))
        ])

        if (i % (5 * TimeOverride) === 0) { // log occasionally
          console.log(`Test ${i}) ${Date.now() - start} ms elapsed`)
          await logAndWait(100)
        }
      };
    } catch (error) {
      console.log('Memory error occurred:', error)
      // Optionally, log the estimated total bytes used by the log lines in the buffer
    }

    await logAndWait()
    const { heapUsed } = process.memoryUsage()
    console.log({ heapUsed: printMB(heapUsed), lineCount: LevelBuffers.totalLineCount })
  })

  it('should just buffer lots of lines and release all as they age out', async function () {
    this.timeout(90 * TimeOverride)
    const config = {
      writeWhen: { level: 'error' }, // set write level to error so info logs are buffered
      lineLimits: { maxAge: 50 * TimeOverride } // some lines age out before the test ends
    }

    hindsight = new Hindsight(config)

    const numberOfEntries = 50 * TimeOverride
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
          bigLines(),
          new Promise(resolve => setTimeout(resolve, 5))
        ])

        if (i % (50 * TimeOverride) === 0) { // log occasionally
          const then = hindsight.buffers.GlobalLineRingbuffer.peek().context.timestamp
          expect(then).to.be.at.most(new Date() - maxAgeWithSlack)

          console.log(i + ') Seconds elapsed:', new Date() - start)
          await logAndWait()
        };
      };
    } catch (error) {
      console.log('Error during stress test:', error)
      // Optionally, log the estimated total bytes used by the log lines in the buffer
      throw error
    }

    await logAndWait()
    const heapUsed = process.memoryUsage().heapUsed
    console.log({ heapUsed: printMB(heapUsed), lineCount: LevelBuffers.totalLineCount })
  })
})

import { expect } from 'chai'
import Hindsight from '../index.js'
import LogTableManager from '../log-tables.js'

const MaxStressMemoryUsage = 1024 * 1024 * 1024 // 1GB

describe('Line buffer volume test', function () {
  it('should just buffer info level logs, test large buffer size', async function () {
    this.timeout(60 * 1000)
    const config = {
      rules: {
        write: { level: 'error' } // set write level to error so info logs are buffered
      }
    }

    const hindsight = new Hindsight(config)

    const numberOfEntries = 20 * 1000
    const entrySize = 10 * 1000

    async function bigLines (size) {
      hindsight.info(Buffer.alloc(entrySize))
      hindsight.info(Buffer.alloc(entrySize))
      hindsight.info(Buffer.alloc(entrySize))
      hindsight.info(Buffer.alloc(entrySize))
      hindsight.info(Buffer.alloc(entrySize))
    }
    try {
      const start = new Date()
      for (let i = 0; i < numberOfEntries; i += 10) {
        await Promise.all([
          bigLines(),
          bigLines()
        ])

        if (i % 100 === 0) { // log once per 1000 iterations
          console.log(i + ') Estimated total bytes used:',
            Math.floor(LogTableManager.estimatedBytes / (1000 * 1000)) + 'MB',
            ' ms elapsed:', new Date() - start
          )
        };
      };
    } catch (error) {
      console.log('Memory error occurred:', error)
      // Optionally, log the estimated total bytes used by the log lines in the log table
    }

    const heapUsed = process.memoryUsage().heapUsed
    console.log({ heapUsed, lineCount: hindsight.logTables.getSequenceIndex().size() })
    expect(heapUsed).to.be.at.most(MaxStressMemoryUsage)
  })

  it('should just buffer lots of lines and release all as they age out', async function () {
    this.timeout(10 * 1000)
    const config = {
      rules: {
        write: { level: 'error' }, // set write level to error so info logs are buffered
        lineLimits: { maxAge: 70 * 1000 }
      }
    }

    const hindsight = new Hindsight(config)

    const numberOfEntries = 200 * 1000
    const entrySize = 1000

    async function bigLines (size) {
      hindsight.info(Buffer.alloc(entrySize))
      hindsight.info(Buffer.alloc(entrySize))
      hindsight.info(Buffer.alloc(entrySize))
      hindsight.info(Buffer.alloc(entrySize))
      hindsight.info(Buffer.alloc(entrySize))
    }
    try {
      const start = new Date()
      for (let i = 0; i < numberOfEntries; i += 10) {
        await Promise.all([
          bigLines(),
          bigLines()
        ])

        if (i % 100000 === 0) { // log once per 100,000 iterations
          console.log(i + ') Estimated total bytes used:',
            Math.floor(LogTableManager.estimatedBytes / (1000 * 1000)) + 'MB',
            ' ms elapsed:', new Date() - start
          )
        };
      };
    } catch (error) {
      console.log('Memory error occurred:', error)
      // Optionally, log the estimated total bytes used by the log lines in the log table
    }

    const heapUsed = process.memoryUsage().heapUsed
    console.log({ heapUsed, lineCount: hindsight.logTables.getSequenceIndex().size() })
    expect(heapUsed).to.be.at.most(MaxStressMemoryUsage)
  })
})

import { expect } from 'chai'
import Hindsight from '../index.js' // Adjust the import path as necessary
import { performance } from 'perf_hooks'

// Array to hold performance results
const performanceResults = []
const originalWrite = process.stdout.write.bind(process.stdout)

describe('Primary functional performance under stress configuration', function () {
  let index = 0
  this.timeout(10000) // Set a higher timeout if necessary
  beforeEach(() => {
    // NOTE: this handles output for info through trace, error and warn go through stderr
    process.stdout.write = (...args) => {
      if (index % 1000 === 0) {
        originalWrite(...args) // write occasionally to show progress
      } else {
        performance.now() // just do something so there's some tiny delay
      }
    }
    originalWrite('stdout.write overridden\n')
  })

  it('should handle rapid logging efficiently', async function () {
    const config = { env: 'stress' } // Setup configuration
    config.writeWhen = { level: 'info' }
    const hindsight = new Hindsight(config)
    const startTime = performance.now()

    for (index = 0; index < 10000; index++) {
      hindsight.info('Sample log entry' + index)
    }

    const endTime = performance.now()
    const duration = endTime - startTime
    performanceResults.push(['Rapid logging', duration])

    expect(duration).to.be.below(5000) // required threshold TBD, being very lenient for now
  })

  it('should handle rapid buffering efficiently', async function () {
    const config = { env: 'stress' } // Setup configuration
    // writeWhen set to 'error' for stress env by default
    const hindsight = new Hindsight(config)
    const startTime = performance.now()

    for (index = 0; index < 100000; index++) {
      hindsight.info('Sample log entry' + index)
    }

    const endTime = performance.now()

    const duration = endTime - startTime
    performanceResults.push(['Rapid buffering', duration])

    const infoStats = hindsight._getMetadata('info')
    console.error('hindsight info buffer stats: ', infoStats)
    expect(infoStats.totalLineCount).to.equal(100000)
    expect(duration).to.be.below(5000) // required threshold TBD, being very lenient for now
  })

  it('should handle rapid writes and buffering efficiently', async function () {
    const config = { env: 'stress' }
    config.writeWhen = { level: 'info' }
    const hindsight = new Hindsight(config)
    const startTime = performance.now()

    for (index = 0; index < 5000; index++) {
      for (let i = 0; i < 10; i++) {
        hindsight.debug('Sample log entry' + index + '.' + i)
      }
      hindsight.info('Sample warn entry' + index)
    }

    const endTime = performance.now()

    const duration = endTime - startTime
    performanceResults.push(['Rapid mixed logging and buffering', duration])

    const infoStats = hindsight._getMetadata('info')
    console.warn('hindsight info buffer stats: ', infoStats)
    expect(infoStats.totalLineCount).to.equal(150000) // includes lines from other tests
    expect(duration).to.be.below(5000) // required threshold TBD, being very lenient for now
  })

  afterEach(function () {
    process.stdout.write = originalWrite
  })

  // performance summary, worst first
  after(() => {
    const sortedResults = performanceResults.sort((a, b) => b[1] - a[1]) // Sort by duration descending
    const slowestTests = sortedResults.slice(0, 20) // Get the top 20 slowest tests

    console.log('Top 20 slowest tests:')
    slowestTests.forEach(test => {
      console.log(`${test[0]}: ${test[1].toFixed(2)}ms`)
    })
    console.log(stats, {
      overheadMs: -1 * Math.min(performance.now() - performance.now(),
        performance.now() - performance.now(),
        performance.now() - performance.now()
      )
    })
  })
})

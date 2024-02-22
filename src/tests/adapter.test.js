import chai from 'chai'
import LogAdapter from '../adapter.js'

const expect = chai.expect

describe('LogAdapter', () => {
  const validModule = console

  describe('constructor', () => {
    it('should create an instance of LogAdapter with the provided module', () => {
      const logAdapter = new LogAdapter(validModule)

      expect(logAdapter).to.be.an.instanceOf(LogAdapter)
      expect(logAdapter.logger).to.equal(validModule)
    })

    it('should have the expected log methods', () => {
      const logAdapter = new LogAdapter(validModule)

      expect(logAdapter.logLevels).to.deep.equal({
        silly: 0,
        verbose: 10,
        trace: 10,
        dir: 10,
        debug: 20,
        log: 20,
        info: 30,
        warn: 40,
        error: 50,
        fatal: 60
      })
    })
  })

  // Add more test cases for other methods in LogAdapter class
})

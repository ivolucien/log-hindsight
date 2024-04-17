import chai from 'chai'
import chaiSpies from 'chai-spies'
import Hindsight from '../index.js'
import ConditionFactory from '../conditions.js'
const expect = chai.expect

chai.use(chaiSpies)

describe('ConditionFactory Tests', function () {
  let hindsight

  beforeEach(function () {
    // Setup Hindsight with default configuration for testing
    hindsight = new Hindsight({ writeWhen: { level: 'error' } })
  })

  describe('createDumpOnError', function () {
    it('should dump all logs on error', function () {
      const dumpOnError = ConditionFactory.createDumpOnError.call(hindsight, 'debug')
      hindsight.writeWhen.writeLineNow = dumpOnError

      // Simulate logging at different levels
      hindsight.debug('Debug message')
      hindsight.info('Info message')
      const metadata = { level: 'error' }

      // Trigger the condition
      expect(dumpOnError(metadata)).to.be.true

      // Verify that writeIf was called to dump logs
      const writeIfSpy = chai.spy.on(hindsight, 'writeIf')
      dumpOnError(metadata)
      expect(writeIfSpy).to.have.been.called.with('debug')
    })
  })

  describe('createOnEveryNth', function () {
    it('should return true for every Nth log line', function () {
      const onEveryNth = ConditionFactory.createOnEveryNth.call(hindsight, 2)
      hindsight.writeWhen = { writeLineNow: onEveryNth }
      hindsight.writeWhen.writeLineNow.bind(hindsight)

      // Simulate logging multiple times
      const metadata = { level: 'info' }
      expect(onEveryNth(metadata)).to.be.true // 1st call, should log
      expect(onEveryNth(metadata)).to.be.false // 2nd call, should not log
      expect(onEveryNth(metadata)).to.be.true // 3rd call, should log again
    })
  })

  describe('createOnDynamicLevel', function () {
    it('should return true if dynamic level allows for logging', function () {
      const dynamicLevelFunction = () => 'debug' // Dynamic level is 'debug'
      const onDynamicLevel = ConditionFactory.createOnDynamicLevel.call(hindsight, dynamicLevelFunction)
      hindsight.writeWhen.writeLineNow = onDynamicLevel

      const metadata = { level: 'info' } // 'info' is above 'debug', so it should log
      expect(onDynamicLevel(metadata, [])).to.be.true
    })

    it('should return false if dynamic level does not allow for logging', function () {
      const dynamicLevelFunction = () => 'warn' // Dynamic level is 'warn'
      const onDynamicLevel = ConditionFactory.createOnDynamicLevel.call(hindsight, dynamicLevelFunction)
      hindsight.writeWhen.writeLineNow = onDynamicLevel

      const metadata = { level: 'info' } // 'info' is below 'warn', so it should not log
      expect(onDynamicLevel(metadata, [])).to.be.false
    })
  })
})

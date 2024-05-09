import { expect } from 'chai'
import Hindsight from '../index.js'

describe('Hindsight child tests', function () {
  let originalHindsight, newLogger

  beforeEach(function () {
    originalHindsight = new Hindsight()
    newLogger = originalHindsight.child({ perLineFields: { key: 'value' } })
  })

  it('should default to console logger for both parent and child', function () {
    expect(originalHindsight.adapter.logger).to.equal(console)
    expect(newLogger.adapter.logger).to.equal(console)
  })

  it('should create a new logger with properties matching the original', function () {
    expect(newLogger.adapter.logger).to.equal(console)
    expect(newLogger.adapter.logMethods).to.deep.equal(originalHindsight.adapter.logMethods)
    newLogger.adapter.levelNames.forEach((name) => {
      expect(newLogger.buffers.getOrCreate(name)).to.include.keys('index', 'lines')
    })
  })

  it('should create a new logger with functional log methods', function () {
    expect(newLogger).to.not.equal(originalHindsight)

    newLogger.adapter.logMethods.forEach((method) => {
      expect(newLogger[method.name]).to.be.a('function')
      expect(newLogger.buffers.getOrCreate(method.name)).to.be.an('object')
    })
  })

  it('should create a child with specific perLineFields', function () {
    const perLineFields = { key: 'value' }
    const childLogger = originalHindsight.child({ perLineFields })

    expect(childLogger).to.be.instanceOf(Hindsight)
    expect(childLogger.perLineFields).to.deep.eql(perLineFields)
  })

  it('should create a child with overriden level', function () {
    const writeWhen = { level: 'error' }
    const childLogger = originalHindsight.child({ writeWhen })

    expect(childLogger.writeWhen.level).to.equal('error')
  })

  describe('Hindsight getOrCreateChild Tests', function () {
    it('should return the same instance for the same perLineFields', function () {
      const perLineFields = { key: 'value' }
      const child1 = Hindsight.getOrCreateChild({ perLineFields }, originalHindsight)
      const child2 = Hindsight.getOrCreateChild({ perLineFields }, originalHindsight)

      expect(child1).to.equal(child2)
    })

    it('should return different instances for different perLineFields', function () {
      const child1 = Hindsight.getOrCreateChild({ perLineFields: { key: 'value1' } }, originalHindsight)
      const child2 = Hindsight.getOrCreateChild({ perLineFields: { key: 'value2' } }, originalHindsight)

      expect(child1).to.not.equal(child2)
    })
  })
})

import { expect } from 'chai'
import Hindsight from '../index.js'

describe('Hindsight Constructor Tests', function () {
  // this function incidentally verifies that falsey caller values don't override defaults
  function validateConstructor (logger) {
    const instance = new Hindsight({ logger })
    expect(instance).to.be.instanceOf(Hindsight)
    expect(instance.adapter.logger).to.equal(logger || console)

    instance.adapter.logMethods.forEach((method) => {
      expect(instance[method.name]).to.be.a('function')
      expect(instance.buffers.getOrCreate(method.name)).to.be.an('object')
    })
    return instance
  }

  it('should depend on default constructor values', function () {
    const obj = validateConstructor()
    expect(obj.adapter.logger).to.equal(console)
  })

  it('should explicitly use console when passed', function () {
    const obj = validateConstructor(console)
    expect(obj.adapter.logger).to.equal(console)
  })

  it('should set custom logger when passed', function () {
    const customLogger = {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {}
    }
    const obj = validateConstructor(customLogger)
    expect(obj.adapter.logger).to.equal(customLogger)
  })

  it('should throw an error for invalid logger', function () {
    const invalidLogger = 'invalidLogger'
    expect(() => {
      // eslint-disable-next-line no-new
      new Hindsight({ logger: invalidLogger })
    }).to.throw(Error, 'Invalid logger')
  })
})

import { expect } from 'chai'
import Hindsight from '../index.js'

describe('Hindsight getter tests', function () {
  describe('instanceId getter', function () {
    it('should return the correct value', function () {
      const hindsight = new Hindsight({})
      const expectedId = 'id' + hindsight._instanceId
      expect(hindsight.instanceId).to.equal(expectedId) // format is 'id' + instanceId

      try {
        hindsight.instanceId = 'test' // should not be able to set instanceId
      } catch (e) {
        // Expect an error to be thrown
      }

      expect(hindsight.instanceId).to.equal(expectedId) // should not have changed
    })
  })

  describe('buffers.get method', function () {
    it('should return the correct buffer', function () {
      const hindsight = new Hindsight()
      const firstId = hindsight._instanceId
      hindsight._debug(hindsight.buffers)
      hindsight.adapter.levelNames.forEach((name) => {
        expect(hindsight.buffers.get(name)).to.deep.eql({ counter: 1 })
      })

      const hindsight2 = new Hindsight()
      const secondId = hindsight2._instanceId
      expect(hindsight2.instanceId).to.equal('id' + secondId)
      expect(secondId).to.equal(firstId + 1)
    })
  })

  // Additional tests for other getters can be added here
})

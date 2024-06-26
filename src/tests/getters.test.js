import { expect } from 'chai'
import Hindsight from '../index.js'

describe('Hindsight getter tests', function () {
  describe('buffers.get method', function () {
    it('should return the correct buffer', function () {
      const hindsight = new Hindsight()

      hindsight.adapter.levelNames.forEach((name) => {
        expect(hindsight.buffers.getOrCreate(name)).to.include.keys('index', 'lines')
      })
    })
  })
  // todo: add tests for other getters
})

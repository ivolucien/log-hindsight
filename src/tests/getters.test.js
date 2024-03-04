import { expect } from 'chai'
import Hindsight from '../index.js'

describe('Hindsight getter tests', function () {
  describe('buffers.get method', function () {
    it('should return the correct buffer', function () {
      const hindsight = new Hindsight()
      hindsight._debug(hindsight.buffers)
      hindsight.adapter.levelNames.forEach((name) => {
        expect(hindsight.buffers.get(name)).to.include.keys('index', 'lines')
      })
    })
  })
  // todo: add tests for other getters
})

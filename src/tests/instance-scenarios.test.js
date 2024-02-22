import { expect } from 'chai'
import Hindsight from '../index.js'

function makeInstanceKey (sessionId) {
  return JSON.stringify({ sessionId })
}

describe('Hindsight instance lifecycle scenarios', function () {
  const testConfig = { instanceLimits: { maxSize: 10, maxAge: 100 } }

  beforeEach(function () {
    // Initialize Hindsight with a fresh QuickLRU instance for each test
    Hindsight.initSingletonTracking(testConfig.instanceLimits)
  })

  it('should handle fast instance turnover correctly', function (done) {
    const hindsight = new Hindsight()
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        Hindsight.getOrCreateChild({ sessionId: `session${i}` }, hindsight)
      }, i) // Stagger by 1ms between each instance
    }

    setTimeout(() => {
      const instances = Hindsight.getInstances()
      instances.forEach((instance) => hindsight._debug({ instance: instance.perLineFields }))
      expect(instances.size).to.be.at.most(10) // maxSize is 10
      expect(instances.has(makeInstanceKey('session19'))).to.be.true // Last instance should be present
      expect(instances.has(makeInstanceKey('session7'))).to.be.false // 8th instance should be evicted
      done()
    }, 60) // Wait longer than count * interval in ms
  })

  it('should expire all instances after maxAge', function (done) {
    const hindsight = new Hindsight()
    Hindsight.getOrCreateChild({ sessionId: 'session1' }, hindsight)
    Hindsight.getOrCreateChild({ sessionId: 'session2' }, hindsight)

    let instances = Hindsight.getInstances()
    expect(instances.size).to.equal(3) // parent + 2 children

    setTimeout(() => {
      instances = Hindsight.getInstances()
      // access instances to trigger lasy eviction
      instances.forEach((instance) => hindsight._debug({ instance: instance.perLineFields }))
      expect(instances.size).to.equal(0) // All instances should be expired
      done()
    }, 200) // Wait longer than maxAge
  })

  it('should correctly generate child instances from top-level instances', function () {
    const parent = new Hindsight()
    const child1 = parent.getOrCreateChild({ sessionId: 'child1' })
    const child2 = parent.getOrCreateChild({ sessionId: 'child2' })

    const instances = Hindsight.getInstances()
    expect(instances.get(makeInstanceKey('child1'))).to.equal(child1)
    expect(instances.get(makeInstanceKey('child2'))).to.equal(child2)
    expect(child1).to.not.equal(child2)
    expect(child1).to.not.equal(parent)
    expect(child2).to.not.equal(parent)
  })

  it('should maintain instance uniqueness despite rapid creation and expiration', function (done) {
    // Rapidly create and expire instances
    const hindsight = new Hindsight(testConfig)
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        Hindsight.getOrCreateChild({ sessionId: `session${i}` }, hindsight)
      }, i * 10) // async creation
    }

    setTimeout(() => {
      const instances = Hindsight.getInstances()
      // access instances to trigger lasy eviction
      instances.forEach((instance) => hindsight._debug({ instance: instance.perLineFields }))
      expect(instances.size).to.be.at.most(6) // 1 parent + 5 children
      // Ensure the first and last created children still exist
      expect(instances.has(makeInstanceKey('session0'))).to.be.false
      expect(instances.has(makeInstanceKey('session4'))).to.be.true
      done()
    }, 120) // After some have expired
  })

  afterEach(function () {
    // Reset HindsightInstances to avoid interference with other tests
    Hindsight.initSingletonTracking()
  })
})

import { expect } from 'chai'
import Hindsight from '../index.js'
import ObjectCache from '../object-cache.js'
import getScopedLoggers from '../internal-loggers.js'
const { trace } = getScopedLoggers('tests:')

function makeInstanceKey (sessionId) {
  return JSON.stringify({ sessionId })
}

describe('Hindsight instance lifecycle scenarios', function () {
  const testConfig = { instanceLimits: { maxSize: 10, maxAge: 100 } }

  beforeEach(function () {
    // Initialize Hindsight with a fresh QuickLRU instance for each test
    ObjectCache.initSingletonTracking(testConfig.instanceLimits)
  })

  it('should handle fast instance turnover correctly', function (done) {
    const hindsight = new Hindsight()
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        Hindsight.getOrCreateChild({ perLineFields: { sessionId: `session${i}` } }, hindsight)
      }, i) // Stagger by 1ms between each instance
    }

    setTimeout(() => {
      const instances = ObjectCache.getInstances()
      instances.forEach((instance) => trace({ instance: instance.perLineFields }))
      expect(instances.size).to.be.at.most(10) // maxSize is 10
      expect(instances.has(makeInstanceKey('session19'))).to.be.true // Last instance should be present
      expect(instances.has(makeInstanceKey('session7'))).to.be.false // 8th instance should be evicted
      done()
    }, 60) // Wait longer than count * interval in ms
  })

  it('should expire all instances after maxAge', function (done) {
    const hindsight = new Hindsight()
    Hindsight.getOrCreateChild({ perLineFields: { sessionId: 'session1' } }, hindsight)
    Hindsight.getOrCreateChild({ perLineFields: { sessionId: 'session2' } }, hindsight)

    let instances = ObjectCache.getInstances()
    expect(instances.size).to.equal(3) // parent + 2 children

    setTimeout(() => {
      instances = ObjectCache.getInstances()
      // access instances to trigger lasy eviction
      instances.forEach((instance) => trace({ instance: instance.perLineFields }))
      expect(instances.size).to.equal(0) // All instances should be expired
      done()
    }, 200) // Wait longer than maxAge
  })

  it('should correctly generate child instances from top-level instances', function () {
    const parent = new Hindsight()
    const child1 = parent.getOrCreateChild({ perLineFields: { sessionId: 'child1' } })
    const child2 = parent.getOrCreateChild({ perLineFields: { sessionId: 'child2' } })

    const instances = ObjectCache.getInstances()
    expect(instances.get(makeInstanceKey('child1'))).to.equal(child1)
    expect(instances.get(makeInstanceKey('child2'))).to.equal(child2)
    expect(child1).to.not.equal(child2)
    expect(child1).to.not.equal(parent)
    expect(child2).to.not.equal(parent)
  })

  it('should maintain instance uniqueness despite rapid creation and expiration', function (done) {
    // Rapidly create and expire instances
    const childCount = 11
    const hindsight = new Hindsight({ ...testConfig, perLineFields: { sessionId: 'parent' } })
    for (let i = 1; i <= childCount; i++) {
      setTimeout(() => {
        Hindsight.getOrCreateChild({ perLineFields: { sessionId: `session${i}` } }, hindsight)
      }, 50) // async creation
    }

    setTimeout(() => {
      const instances = ObjectCache.getInstances()
      const expectedUnique = {}
      // access instances to trigger lazy eviction
      instances.forEach((instance) => {
        trace(instance.perLineFields)
        expectedUnique[instance.perLineFields.sessionId] = true
      })
      trace({ expectedUnique, size: instances.size, maxSize: instances.maxSize })
      expect(instances.size).to.be.at.most(childCount + 1) // QuickLRU has off by one bug?
      expect(Object.keys(expectedUnique).length).to.be.not.lessThan(instances.size) // All keys should be unique

      done()
    }, 120) // parent has expired
  })

  afterEach(function () {
    // Reset singleton tracking to avoid interfering with other tests
    ObjectCache.initSingletonTracking()
  })
})

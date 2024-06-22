// lifecycle.test.js
import { expect } from 'chai'
import Hindsight from '../index.js'
import ObjectCache from '../object-cache.js'

function makeKey (fields) {
  return JSON.stringify(fields)
}

describe('Hindsight Instance Lifecycle Management with QuickLRU', function () {
  let hindsight
  let instances
  const testPerLineFields = { sessionId: 'testSession' }
  const testPerLineFields2 = { sessionId: 'testSession2' }

  beforeEach(function () {
    // Initialize Hindsight with a fresh QuickLRU instance
    ObjectCache.initSingletonTracking()
    hindsight = new Hindsight()
  })

  afterEach(function () {
    // Reset singleton tracking to avoid interfering with other tests
    ObjectCache.initSingletonTracking()
  })

  it('should correctly create and retrieve instances', function () {
    const instance1 = Hindsight.getOrCreateChild({ perLineFields: testPerLineFields }, hindsight)
    expect(instance1).to.be.instanceOf(Hindsight)

    const instance2 = Hindsight.getOrCreateChild({ perLineFields: testPerLineFields }, hindsight)
    expect(instance1).to.equal(instance2) // Should retrieve the same instance
  })

  it('should evict least recently used instances', function () {
    // Configure Hindsight with a small maxSize for testing
    ObjectCache.initSingletonTracking({ maxSize: 2, maxAge: 1000 })

    const instance1 = Hindsight.getOrCreateChild({ perLineFields: testPerLineFields }, hindsight)
    Hindsight.getOrCreateChild({ perLineFields: testPerLineFields2 }, hindsight)

    // Access instance1 to make it recently used
    Hindsight.getOrCreateChild({ perLineFields: testPerLineFields }, hindsight)

    // Add a new instance to trigger eviction
    const testPerLineFields3 = { sessionId: 'testSession3' }
    const instance3 = Hindsight.getOrCreateChild({ perLineFields: testPerLineFields3 }, hindsight)

    instances = ObjectCache.getInstances()
    console.log({ maxSize: instances.maxSize, size: instances.size })

    expect(instances.has(makeKey(testPerLineFields))).to.be.true
    expect(instances.get(makeKey(testPerLineFields))).to.equal(instance1)
    expect(instances.has(makeKey(testPerLineFields2))).to.be.false // instance2 should be evicted
    expect(instances.has(makeKey(testPerLineFields3))).to.be.true
    expect(instances.get(makeKey(testPerLineFields3))).to.equal(instance3)
  })

  it('should evict instances older than maxAge', function (done) {
    // Configure Hindsight with a small maxAge for testing
    ObjectCache.initSingletonTracking({ maxSize: 5, maxAge: 100 })

    Hindsight.getOrCreateChild({ perLineFields: testPerLineFields }, hindsight) // instance 1

    setTimeout(() => {
      const instance2 = Hindsight.getOrCreateChild({ perLineFields: testPerLineFields2 }, hindsight)
      instances = ObjectCache.getInstances()
      expect(instances.has(makeKey(testPerLineFields))).to.be.false // instance1 should be evicted

      expect(instances.has(makeKey(testPerLineFields2))).to.be.true
      expect(instances.get(makeKey(testPerLineFields2))).to.equal(instance2)
      done()
    }, 150) // Wait longer than maxAge
  })

  it('should refresh instance position in LRU cache on update', function () {
    // Configure Hindsight with a small maxSize for testing
    ObjectCache.initSingletonTracking({ maxSize: 2, maxAge: 1000 })

    const instance1 = Hindsight.getOrCreateChild({ perLineFields: testPerLineFields }, hindsight)
    Hindsight.getOrCreateChild({ perLineFields: testPerLineFields2 }, hindsight)

    // Access instance1 to make it recently used
    Hindsight.getOrCreateChild({ perLineFields: testPerLineFields }, hindsight)

    // Add a new instance to trigger eviction
    const testPerLineFields3 = { sessionId: 'testSession3' }
    const instance3 = Hindsight.getOrCreateChild({ perLineFields: testPerLineFields3 }, hindsight)

    instances = ObjectCache.getInstances()
    expect(instances.has(makeKey(testPerLineFields))).to.be.true
    expect(instances.get(makeKey(testPerLineFields))).to.equal(instance1)

    expect(instances.has(makeKey(testPerLineFields2))).to.be.false // instance2 should be evicted

    expect(instances.has(makeKey(testPerLineFields3))).to.be.true
    expect(instances.get(makeKey(testPerLineFields3))).to.equal(instance3)
  })
})

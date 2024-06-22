// instance-related functions and variables from index.js

import QuickLRU from 'quick-lru'
import Hindsight from './index.js'
import { getConfig } from './config.js'
import getScopedLoggers from './internal-loggers.js'
const { trace, info } = getScopedLoggers('object-cache')

const diagnosticStats = {} // assuming this is re`lated to instance tracking, otherwise remove

function setStressStat (key, valueMethod) {
  if (process.env.NODE_ENV === 'stress' && typeof valueMethod === 'function') {
    diagnosticStats[key] = valueMethod(diagnosticStats[key])
  }
}

const registry = new FinalizationRegistry((name) => {
  setStressStat('gcCount', (gcCounts = {}) => {
    const shortName = name.slice(0, 20)
    gcCounts[shortName] = (gcCounts[shortName] || 0) + 1
    return gcCounts
  })
})

let GlobalHindsightInstances

class ObjectCache {
  constructor (instanceLimits) {
    ObjectCache.initSingletonTracking(instanceLimits)
  }

  static getInstances (instanceLimits = getConfig().instanceLimits) { // for manual instance management and test use
    if (GlobalHindsightInstances == null) {
      ObjectCache.initSingletonTracking(instanceLimits)
    }
    return GlobalHindsightInstances
  }

  static initSingletonTracking (instanceLimits = getConfig().instanceLimits) {
    if (instanceLimits.maxAge == null || instanceLimits.maxSize == null) {
      GlobalHindsightInstances = null
      return
    }

    const limits = {
      ...getConfig().instanceLimits,
      ...instanceLimits,
      onEviction: (key, value) => value.delete()
    }
    info('Global Hindsight instance tracking initialized', { limits })
    GlobalHindsightInstances = new QuickLRU(limits) // can use in tests to reset state
  }

  static getInstanceIndexString (perLineFields = {}) {
    return JSON.stringify(perLineFields)
  }

  static set (key, object) {
    if (GlobalHindsightInstances == null) {
      return
    }
    registry.register(object, key)
    GlobalHindsightInstances.set(key, object)
  }

  static cleanupExpiredInstances () {
    if (GlobalHindsightInstances == null) {
      return
    }
    for (const [key, instance] of GlobalHindsightInstances) {
      if (instance.isExpired) {
        instance.delete(key)
        setStressStat('expiredCount', (oldCount = 0) => oldCount + 1)
      }
    }
  }

  static getOrCreateChild (config, parentHindsight) {
    if (GlobalHindsightInstances == null) {
      ObjectCache.initSingletonTracking(config.instanceLimits)
      if (GlobalHindsightInstances == null) {
        return
      }
    }
    const { perLineFields } = config || {}

    const indexKey = ObjectCache.getInstanceIndexString(perLineFields)
    trace('getOrCreateChild called', { indexKey, perLineFields })
    let instance = ObjectCache.getInstances()?.get(indexKey)
    if (instance?.isExpired && ObjectCache.getInstances()) {
      ObjectCache.getInstances()?.delete(indexKey)
      instance = null
    }

    if (!instance) {
      return parentHindsight
        ? parentHindsight.child({ perLineFields }) // derived instance
        : new Hindsight(config)
    }
    instance.modifiedAt = new Date() // reset its expiration period
    setStressStat('childRetrievedCount', (oldCount = 0) => oldCount + 1)
    return instance
  }
}

export default ObjectCache

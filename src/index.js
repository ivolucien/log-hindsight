// src/index.js
import { setTimeout } from 'timers/promises'
import { Mutex } from 'async-mutex'
import QuickLRU from 'quick-lru' // todo:  consider js-lru or lru-cache to externalize ttl handling

import { getConfig } from './config.js'
import LogAdapter from './adapter.js'
import LevelBuffers from './level-buffers.js'
import getScopedLoggers from './internal-loggers.js'
const { trace, info, error } = getScopedLoggers('hindsight')

// todo: track child instances per parent instance, add method for deleting instances
// since we want logs to persist between task or API calls, track the instances to delay garbage collection
let GlobalHindsightInstances

/**
 * Hindsight is a logger wrapper that buffers log lines and supports conditional logging logic.
 * It maintains buffers of log lines for each log level, and keeps per-line metadata.
 * Can be used to associate a child logger for each user session, task or endpoint call,
 * configure output rules on a per logger basis and dynamically write log lines using custom logic.
 *
 * @class
 * @constructor
 * @param {Object} config - Hindsight configuration object, initialized instance tracking if needed.
 * @param {Object} [config.instanceLimits] - The limits for the number of Hindsight instances.
 * @param {Object} [config.lineLimits] - The limits to buffering log lines, by age, count and bytes.
 * @param {Object} [config.logger=console] - The logger object to be used for logging.
 * @param {Object} [config.filterData] - Trim and/or transform log line args, when buffered for now..
 * @param {Object} [config.writeWhen] - Write vs buffer condition(s) for log line handling.
 * @param {Object} perLineFields - The object properties to always log, stringified for singleton key.
  */
export default class Hindsight {
  adapter
  // all log methods initialized in _initWrapper, including trace, info, error, etc.
  buffers
  perLineFields = {}
  buffersMutex
  batchSize = 100

  _writeWhen = {}

  static initSingletonTracking (instanceLimits) {
    const limits = { ...getConfig().instanceLimits, ...instanceLimits }
    info('Global Hindsight instance tracking initialized', { limits })
    GlobalHindsightInstances = new QuickLRU(limits) // can use in tests to reset state
  }

  static getInstances () { // for manual instance management and test use
    return GlobalHindsightInstances
  }

  static getInstanceIndexString (perLineFields = {}) {
    return JSON.stringify(perLineFields)
  }

  static cleanupExpiredInstances () {
    for (const [key, instance] of GlobalHindsightInstances) {
      if (instance.isExpired()) {
        GlobalHindsightInstances.delete(key);
      }
    }
  }

  static getOrCreateChild ({ perLineFields }, parentHindsight) {
    if (!GlobalHindsightInstances) {
      Hindsight.initSingletonTracking()
    }
    const indexKey = Hindsight.getInstanceIndexString(perLineFields)
    trace('getOrCreateChild called', { indexKey, perLineFields })
    const instance = GlobalHindsightInstances.get(indexKey)
    if (!instance) {
      return parentHindsight
        ? parentHindsight.child({ perLineFields }) // derived instance
        : new Hindsight({ perLineFields }) // new instance
    }
    return instance
  }

  constructor (config = {}) {
    const { perLineFields } = config || {}
    const { lineLimits, logger, writeWhen } = getConfig(config)
    trace('Hindsight constructor called', { lineLimits, writeWhen, perLineFields })

    this.adapter = new LogAdapter(logger, perLineFields)

    this.perLineFields = perLineFields
    this.filterData = config.filterData || this._shallowCopy

    this.buffersMutex = new Mutex()
    this._writeWhen = writeWhen
    if (typeof this._writeWhen.writeLineNow === 'function') {
      this._writeWhen.writeLineNow = this._writeWhen.writeLineNow.bind(this)
    }

    this.buffers = new LevelBuffers({ ...lineLimits, maxLineCount: lineLimits.maxCount })

    const instanceSignature = Hindsight.getInstanceIndexString(perLineFields)
    trace('constructor', { instanceSignature, moduleKeys: Object.keys(logger) })
    this._initWrapper()
    if (GlobalHindsightInstances == null) {
      Hindsight.initSingletonTracking(config?.instanceLimits)
    }
    GlobalHindsightInstances.set(instanceSignature, this) // add to instances map?
  }

  getOrCreateChild (...args) {
    return Hindsight.getOrCreateChild(...args, this)
  }

  /**
   * Creates a Hindsight logger instance using `this` as a base, overriding parent config with the child's.
   * The new instance will have a child base logger if the original logger has child functionality.
   * @returns {Hindsight} A new Hindsight instance.
   */
  child ({ lineLimits = {}, perLineFields = {}, writeWhen = {} } = {}) {
    trace('child called', { lineLimits, perLineFields })
    const { logger } = this.adapter
    const combinedFields = { ...this.perLineFields, ...perLineFields }
    const combinedWriteWhen = { ...this._writeWhen, ...writeWhen }
    const combinedLimits = { ...this.buffers.lineLimits, ...lineLimits }

    const innerChild = logger.child ? logger.child(perLineFields) : logger // use child factory if available
    const childConfig = {
      instanceLimits: { maxAge: GlobalHindsightInstances.maxAge, maxSize: GlobalHindsightInstances.maxSize },
      lineLimits: combinedLimits,
      logger: innerChild,
      writeWhen: combinedWriteWhen
    }
    return new Hindsight({ ...childConfig, perLineFields: combinedFields })
  }

  toInt (level) {
    return this.adapter.levelLookup[level]
  }

  get totalLineCount () {
    return this.buffers.GlobalLineRingbuffer.size()
  }

  get writeWhen () {
    return { ...this._writeWhen }
  }

  set writeWhen (writeWhen) {
    this._writeWhen.level = this.toInt(writeWhen?.level) >= 0 ? writeWhen.level : this._writeWhen.level
    this._writeWhen.writeLineNow = writeWhen.writeLineNow || this._writeWhen.writeLineNow
    if (typeof this._writeWhen.writeLineNow === 'function') {
      this._writeWhen.writeLineNow = this._writeWhen.writeLineNow.bind(this)
    }
  }

  /**
   * Limits the buffers based on the configured maximums. The method iterates over
   * each limit criteria, calling the corresponding private line limit method for each
   * criteria with the currently configured limit.
   */
  applyLineLimits () {
    trace('applyLineLimits called')
    this.buffers.limitByMaxAge()
    this.buffers.limitByMaxBytes()
    this.buffers.limitByMaxCount()
  }

  async _batchYield () {
    trace('batchYield called')
    await new Promise((resolve) => setImmediate(resolve)) // yield to event loop
  }

  async _pushMatchingLines (levelName, writeLineNow, linesOut) {
    const buffer = this.buffers.getOrCreate(levelName)
    let batchCount = 1

    trace(`writeIf matching for '${levelName}'`)
    for (const [/* index */, line] of buffer.lines) { // destructure, ignore index here
      if (line != null && line.context != null && line.context.written !== true) {
        const metadata = this._getMetadata(levelName, line.context)

        if (await writeLineNow({ metadata, payload: line.payload })) {
          linesOut.push(line)
        }
      }
      if (batchCount++ % this.batchSize === 0) {
        trace('writeIf matching  batch', { batchCount })
        await this._batchYield()
      }
    }
    return linesOut
  }

  /**
   * User-defined function that is called for each buffered line to decide if it's written.
   * This function should return `true` to write the line immediately, or `false` to keep it buffered.
   *
   * @callback writeLineNow
   * @param {Object} args - contains named parameters metadata and payload
   * @param {Object} args.metadata - Context object for the log line, with module and buffer stats.
   * @param {Array} args.payload - The original arguments passed to the proxied log method.
   * @returns {boolean} - `true` to write the line immediately, `false` to keep it buffered.
   */

  /**
   * Iterates over log level buffers at or above levelCutoff, writing all lines where the provided
   *   `writeLineNow` function returns true.
   * Call this to write this session's history. (presumes you've stored session Id in perLineFields)
   *
   * @param {string} levelCutoff - Filter out lines below this level before perLineWriteDecision is called.
   * @param {function} writeLineNow - A user-defined function that decides if each line is written.
   */
  writeIf (levelCutoff, writeLineNow = async (/* metadata, lineArgs */) => true) {
    // NOTE: writeIf is intentionally not async. it does call async functions for background processing.
    trace('writeIf called', { levelCutoff })

    // fire and forget since it might take quite a while to complete
    ;(async () => { // must ;
      try {
        // reserve the buffers for exclusive access by batch processing
        await this.buffersMutex.runExclusive(async () => {
          trace('writeIf async fired to forget')
          const linesOut = []
          let batchCount = 1

          // walk through level buffers in order to identify lines to write
          for (const levelName of this.adapter.levelNames) {
            const meetsThreshold = this.toInt(levelName) >= this.toInt(levelCutoff)
            if (!meetsThreshold) {
              trace('level below threshold')
              continue
            }

            await this._pushMatchingLines(levelName, writeLineNow, linesOut)
          }
          // Sort lines by line.context.timestamp in ascending order
          trace({ linesOutCount: linesOut.length })
          // todo: review performance of sort for large sets of lines
          linesOut.sort((a, b) => a.context.timestamp - b.context.timestamp) // reasonably efficient

          for (const line of linesOut) {
            this._writeLine(line.context.name, line.context, line.payload)
            this.buffers.deleteLine(line)

            if (batchCount++ % this.batchSize === 0) {
              trace('Batch writeIf', { batchCount })
              await this._batchYield(batchCount++) // only await yield at batch end
            }
          }
        })
      } catch (err) {
        error('Error in writeIf call, some lines might not have been written')
        error(err)
      }
      // review for use of a finally clause if this is extended to use external resources
    })()
  }

  /**
   * Sets up wrapper logging by initializing buffers and methods.
   * This method configures the wrapper to intercept and manage log calls.
   * @private
   */
  _initWrapper () {
    trace('_initWrapper called')
    this.adapter.levelNames.forEach((levelName) => {
      // populate this wrapper log method
      this[levelName] = (...payload) => {
        this._logIntake({ name: levelName, level: this.toInt(levelName) }, payload)
      }
      this[levelName].writeCounter = 0 // initialize counter for this log method, for tests
    })
  }

  /**
   * Logs the provided metadata and payload.
   *
   * @param {Object} metadata - The metadata object containing additional information for the log.
   * @param {Array} payload - The original args passed to the proxied log method.
   * @returns {void}
   */
  async _logIntake (metadata, payload) {
    trace('_logIntake called', metadata)
    // pull name from metadata, set defaults for specific metadata properties
    const {
      name,
      ...context
    } = {
      name: 'info',
      timestamp: Date.now(),
      ...metadata
    }
    // todo: support options and/or format properties in metadata
    // todo: write sanitize function to remove sensitive data from log lines, if specified

    const action = this._selectAction(name, context, payload)
    trace({ action, timestamp: context.timestamp, sequence: context.sequence, bytes: context.lineBytes })
    if (action === 'discard') { return }

    if (action === 'write') {
      this._writeLine(name, context, payload)
    } else if (action === 'buffer') {
      await this._bufferLine(name, context, payload)
    }
  }

  _getMetadata (levelName, context = {}) {
    const buffer = this.buffers.getOrCreate(levelName)
    const metadata = {
      estimatedBufferBytes: this.buffers.estimatedBytes,
      totalLineCount: this.totalLineCount,
      levelLinesBuffered: buffer.size,
      levelLinesWritten: this[levelName].writeCounter,
      level: levelName,
      perLineFields: this.perLineFields,
      timestamp: context.timestamp,
      estimatedLineBytes: context.lineBytes
    }
    return metadata
  }

  _selectAction (name, context, payload) {
    // todo? move into write logic module as this expands
    trace('_selectAction called', { name, lineBytes: context.lineBytes, lineArgCount: payload.length })
    if (payload.length === 0) {
      return 'discard' // log nothing if called with no payload
    } else if (typeof this._writeWhen.writeLineNow === 'function') {
      const metadata = this._getMetadata(name, context)
      return this._writeWhen.writeLineNow({ metadata, lineArgs: payload })
    }

    // todo: move to a getIntLevel() property?
    const threshold = this.toInt(this?._writeWhen?.level)
    const lineLevel = this.toInt(context.level || name)
    trace({ threshold, lineLevel })

    if (lineLevel < threshold) {
      return 'buffer'
    } else {
      return 'write'
    }
  }

  // todo: support removing the log line from the buffer, for now just mark as written
  /**
   * Writes a log line to the original logger method if it hasn't been written before.
   *
   * @param {string} name - The logger method to call, such as 'info' or 'error'.
   * @param {object} context - The context object to track if the log line has been written.
   * @param {Array} payload - The arguments to pass to the original logger method.
   */
  _writeLine (name, context, payload) {
    trace('_writeLine called', { level: name, timestamp: context.timestamp, sequence: context.sequence })
    if (context.written !== true && payload?.length > 0) {
      context.written = true
      this[name].writeCounter++

      const payloadWithFields = this._addPerLineFields(payload)
      this.adapter[name](...payloadWithFields) // todo: use native logger method to include perLineFields
    }
  }

  _addPerLineFields (payload) {
    if (this.adapter.lineFields == null) {
      return payload // the base module has the per line fields
    }
    return [...payload, this.adapter.lineFields]
  }

  // todo: add max_depth config option, clone to that depth and drop everything below it
  _shallowCopy (payload) {
    const filtered = payload.map((arg) => {
      if (typeof arg !== 'object' || arg instanceof Error) {
        return arg
      } else {
        return Array.isArray(arg) && arg.slice ? arg.slice() : { ...arg }
      }
    })
    return filtered
  }

  async _bufferLine (name, context, payload) {
    const filteredArgs = this.filterData(payload)
    const logEntry = {
      context: { name, ...context },
      payload: filteredArgs
    }
    this.buffers.addLine(name, logEntry)
    if (this._bufferCount++ % 100 !== 0) {
      return
    }
    trace('_bufferLine was called', name, context)
    this.applyLineLimits()
  }
}

// src/index.js
import { getConfig } from './config.js'
import LogAdapter from './adapter.js'
import LevelBuffers from './level-buffers.js'
import QuickLRU from 'quick-lru' // todo:  consider js-lru or lru-cache to externalize ttl handling

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
  _diagnosticLogLevel // private _trace through _error methods defined at end of class

  adapter
  // all log methods initialized in _initWrapper, including trace, info, error, etc.
  buffers
  perLineFields = {}
  writeWhen = {}

  static initSingletonTracking (instanceLimits = getConfig().instanceLimits) {
    GlobalHindsightInstances = new QuickLRU(instanceLimits) // can use in tests to reset state
  }

  static getInstances () { // for manual instance management and test use
    return GlobalHindsightInstances
  }

  static getInstanceIndexString (perLineFields = {}) {
    return JSON.stringify(perLineFields)
  }

  static getOrCreateChild (perLineFields, parentHindsight) {
    const indexKey = Hindsight.getInstanceIndexString(perLineFields)
    parentHindsight._debug({ indexKey, perLineFields })
    const existingInstance = GlobalHindsightInstances.get(indexKey)
    return existingInstance || parentHindsight.child({ perLineFields })
  }

  constructor (config = {}, perLineFields = {}) {
    const { lineLimits, logger, writeWhen } = getConfig(config)

    this.adapter = new LogAdapter(logger)
    this._initInternalLogging()
    this._debug('Hindsight constructor called', { lineLimits, writeWhen, perLineFields })

    this.perLineFields = perLineFields
    this.filterData = config.filterData || this._shallowCopy

    this.writeWhen = writeWhen
    if (typeof this.writeWhen.writeLineNow === 'function') {
      this.writeWhen.writeLineNow = this.writeWhen.writeLineNow.bind(this)
    }

    this.buffers = new LevelBuffers({ ...lineLimits, maxLineCount: lineLimits.maxSize })

    const instanceSignature = Hindsight.getInstanceIndexString(perLineFields)
    this._debug('constructor', { instanceSignature, moduleKeys: Object.keys(logger) })
    this._initWrapper()
    if (GlobalHindsightInstances == null) {
      Hindsight.initSingletonTracking(config?.instanceLimits)
    }
    GlobalHindsightInstances.set(instanceSignature, this) // add to instances map?
  }

  getOrCreateChild (perLineFields) {
    return Hindsight.getOrCreateChild(perLineFields, this)
  }

  /**
   * Creates a Hindsight logger instance using `this` as a base, overriding perLineFields and/or writeWhen.
   * The new instance will have a child logger instance if the original logger has child functionality.
   * @returns {Hindsight} A new Hindsight instance.
   */
  child ({ lineLimits = {}, perLineFields = {}, writeWhen = {} } = {}) {
    const { logger } = this.adapter
    const combinedFields = { ...this.perLineFields, ...perLineFields }
    const combinedwriteWhen = { ...this.writeWhen, ...writeWhen }
    const combinedLimits = { ...this.buffers.lineLimits, ...lineLimits }

    const innerChild = logger.child ? logger.child(perLineFields) : logger // use child factory if available
    const childConfig = {
      instanceLimits: { maxAge: GlobalHindsightInstances.maxAge, maxSize: GlobalHindsightInstances.maxSize },
      lineLimits: combinedLimits,
      logger: innerChild,
      writeWhen: combinedwriteWhen
    }
    this._debug({ childConfig, combinedFields })
    return new Hindsight(childConfig, combinedFields)
  }

  levelValue (level) {
    return this.adapter.levelLookup[level]
  }

  // Get and set the current module log level, this is separate from the proxied logger.
  get moduleLogLevel () {
    return this._diagnosticLogLevel
  }

  set moduleLogLevel (level) {
    this._diagnosticLogLevel = this.levelValue(level) || this.moduleLogLevel
  }

  /**
   * Limits the buffers based on the configured maximums. The method iterates over
   * each limit criteria, calling the corresponding private line limit method for each
   * criteria with the currently configured limit.
   */
  // todo: this doesn't need to be dynamic, just call the methods directly
  applyLineLimits () {
    this.buffers.limitByMaxAge()
    this.buffers.limitByMaxBytes()
    this.buffers.limitByMaxSize()
  }

  /**
   * User-defined function that is called for each buffered line to decide if it's written.
   * This function should return `true` to write the line immediately, or `false` to keep it buffered.
   *
   * @callback perLineWriteDecision
   * @param {Object} lineContext - The context object for the log line, including metadata like log level and timestamp.
   * @param {Array} linePayload - The original arguments passed to the proxied log method.
   * @param {Object} moduleStats - Statistics for the module, such as `estimatedBytes` and `totalLineCount`.
   * @returns {boolean} - `true` to write the line immediately, `false` to keep it buffered.
   */

  /**
   * Iterates over log level buffers at or above levelCutoff and writes all lines based on the decision made by the provided `writeDecision` function.
   * Call this to write this session's history. (presumes you've stored session Id in perLineFields)
   *
   * @param {string} levelCutoff - Filter out lines below this level before perLineWriteDecision is called.
   * @param {function} writeLineNow - A user-defined function that decides if each line is written.
   */
  writeIf (levelCutoff, writeLineNow = (/* metadata, lineArgs */) => true) {
    const linesOut = []
    this.adapter.levelNames.forEach((levelName) => {
      const meetsThreshold = this.levelValue(levelName) >= this.levelValue(levelCutoff)
      if (!meetsThreshold) {
        return
      }
      const buffer = this.buffers.get(levelName)

      buffer.lines.forEach((line) => {
        // todo: write as batched async to avoid blocking the event loop for large buffers
        if (line != null && line.context != null) {
          const metadata = this._getMetadata(levelName, line.context)

          if (writeLineNow({ metadata, lineArgs: line.payload })) {
            line.context.name = levelName // add name to context for writing chronologically across levels
            linesOut.push(line)
          }
        }
      })
    })

    // Sort lines by line.context.timestamp in ascending order
    linesOut.sort((a, b) => a.context.timestamp - b.context.timestamp)

    linesOut.forEach((line) => {
      // todo: consider making this async to avoid blocking the event loop for large buffers
      this._writeLine(line.context.name, line.context, line.payload)
      this.buffers.deleteLine(line)
    })
  }

  /**
   * Sets up internal (console) log methods for Hindsight code with '_' prefix.
   * These methods are used for logging within the Hindsight class itself.
   * @private
   */
  _initInternalLogging () {
    const levelName = process.env.HINDSIGHT_LOG_LEVEL || 'error'
    this._diagnosticLogLevel = levelName
  }

  /**
   * Sets up wrapper logging by initializing buffers and methods.
   * This method configures the wrapper to intercept and manage log calls.
   * @private
   */
  _initWrapper () {
    this.adapter.levelNames.forEach((levelName) => {
      // populate this wrapper log method
      this[levelName] = (...payload) => {
        this._logIntake({ name: levelName, level: this.levelValue(levelName) }, payload)
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
  _logIntake (metadata, payload) {
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
    this._debug({ action, context })
    if (action === 'discard') { return }

    if (action === 'write') {
      this._writeLine(name, context, payload)
    } else if (action === 'buffer') {
      this._bufferLine(name, context, payload)
    }
  }

  _getMetadata (levelName, context) {
    const buffer = this.buffers.get(levelName)
    const metadata = {
      estimatedBufferBytes: this.buffers.estimatedBytes,
      totalLineCount: this.buffers.GlobalLineRingbuffer.size(),
      levelLinesBuffered: buffer.size,
      levelLinesWritten: this[levelName].writeCounter,
      level: levelName,
      timestamp: context.timestamp,
      estimatedLineBytes: context.lineBytes
    }
    return metadata
  }

  _selectAction (name, context, payload) {
    // todo? move into write logic module as this expands
    if (payload.length === 0) {
      return 'discard' // log nothing if called with no payload
    } else if (typeof this.writeWhen.writeLineNow === 'function') {
      const metadata = this._getMetadata(name, context)
      return this.writeWhen.writeLineNow({ metadata, lineArgs: payload })
    }

    // todo: move to a getIntLevel() property?
    const threshold = this.levelValue(this?.writeWhen?.level)
    const lineLevel = this.levelValue(context.level || name)
    this._debug({ threshold, lineLevel })

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
    if (context.written !== true && payload?.length > 0) {
      context.written = true
      this[name].writeCounter++
      this.adapter[name](...payload) // pass to the u niversal logger adapter
    }
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

  _bufferLine (name, context, payload) {
    const filteredArgs = this.filterData(payload)
    const logEntry = {
      context: { name, ...context },
      payload: filteredArgs
    }
    this.buffers.addLine(name, logEntry)
    this.applyLineLimits()
  }

  _levelCheck (level) {
    return this.levelValue(level) >= this.levelValue(this._diagnosticLogLevel)
  }

  _trace (...payload) {
    this._levelCheck('trace') && console.trace(...payload)
  }

  _debug (...payload) {
    this._levelCheck('debug') && console.debug(...payload)
  }

  _info (...payload) {
    this._levelCheck('info') && console.info(...payload)
  }

  _warn (...payload) {
    this._levelCheck('warn') && console.warn(...payload)
  }

  _error (...payload) {
    this._levelCheck('error') && console.error(...payload)
  }
}

// todo: add lineLimits / purge function to keep to specified data limits (cullLogLines?)
// todo: add method to use rules to sanitize, keep or write log lines (logDirector?)

/*
hindsight.buffers format
LevelBuffers: {
  info: {
    sequence<integer>: {
      context: {
        name<string>,
        timestamp<number>,
        sequence<integer>,
        ...<any>
      },
      payload: [
        // examples, not required
        { message: * },
        err<Error>,
        ...<any>
      ]
    }
  },
  warn: {
    ...
  },
  ...
}
*/

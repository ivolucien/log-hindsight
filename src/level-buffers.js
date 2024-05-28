// src/level-buffers.js
import v8 from 'v8'
import os from 'os'
import RingBuffer from 'ringbufferjs' // "js" here is not a file extension
import LineBuffer from './line-buffer.js'
import getScopedLoggers from './internal-loggers.js'
const { trace } = getScopedLoggers('level-buffers')

// aggregate line tracking across all buffers, for implementing global limits
let GlobalLineRingbuffer // call initGlobalLineTracking() to reset for tests

// rough estimate of the total byte size of all log lines, likely to be lower than actual
let TotalEstimatedLineBytes = 0

class LevelBuffers {
  maxLineAgeMs

  /**
   * Constructs a LevelBuffers object, initializing the global sequence index if required.
   * @param {Object} options - Configuration for the LevelBuffers object.
   * @param {number} options.maxLineCount - The maximum combined total line count.
   */
  constructor ({ maxAge, maxLineCount }) {
    trace('LevelBuffers constructor called')
    this.levels = {}
    this.maxLineAgeMs = maxAge
    if (GlobalLineRingbuffer == null) {
      LevelBuffers.initGlobalLineTracking(maxLineCount)
    }
  }

  /**
   * Initializes the global index for buffers.
   * This function is also useful for clearing the static index during tests.
   *
   * @param {number} maxLineCount - The maximum combined total of all log lines.
   * @returns {void}
   */
  static initGlobalLineTracking (maxLineCount) {
    trace('initGlobalLineTracking called')
    TotalEstimatedLineBytes = 0
    GlobalLineRingbuffer = new RingBuffer( // init singleton on first constructor call
      maxLineCount, // max total of all log lines
      (line) => LevelBuffers._deleteLineFromBuffer(line.context) // eviction callback for last out lines
    )
  }

  // remove log line from the buffer referenced in the line's context object
  static _deleteLineFromBuffer (context) {
    trace('_deleteLineFromBuffer called')
    const buffer = context.buffer
    TotalEstimatedLineBytes = Math.max(0, TotalEstimatedLineBytes - context.lineBytes) // stay >= 0

    buffer.delete(context.sequence)
  }

  static get TotalEstimatedLineBytes () { return TotalEstimatedLineBytes }

  get GlobalLineRingbuffer () {
    return GlobalLineRingbuffer // undefined if not initialized by constructor
  }

  get lineLimits () {
    return {
      maxAge: this.maxLineAgeMs,
      maxCount: GlobalLineRingbuffer.capacity()
    }
  }

  /**
   * Retrieves the buffer for the specified level name. If the buffer does not exist, it will be created.
   *
   * @param {string} levelName - The name of the log level.
   * @returns {object} - The buffer object for the specified level name.
   */
  getOrCreate (levelName) {
    if (!this.levels[levelName]) {
      this.levels[levelName] = new LineBuffer()
    }
    return this.levels[levelName]
  }

  /**
   * Adds a line to the specified level's buffer and the sequence index.
   * @param {string} levelName - The name of the level.
   * @param {any} line - The line to be added.
   * @returns {number} - The sequence number of the added line.
   */
  addLine (levelName, line) {
    trace('addLine called')

    const buffer = this.getOrCreate(levelName)
    line.context.buffer = buffer // Add buffer and sequence to context as a back-reference when deleting lines
    line.context.sequence = buffer.add(line)

    // todo: figure out garbage collection for expired lines and the sequence index
    GlobalLineRingbuffer.enq(line) // add to sequence index
    return line.context.sequence
  }

  /**
   * Mark the referenced line as deleted and clear its payload, idempotently.
   * @param {Object} line - The line including its context object.
   */
  deleteLine (line) {
    // must soft delete from sequence index as it only supports deletion from the tail
    delete line.payload
    line.context.deleted = true
    LevelBuffers._deleteLineFromBuffer(line.context)
  }

  /**
   * Removes previously handled lines from the end of the buffer, up to the last active line.
   * Lines are removed from both the sequence index and the level's line buffer.
   */
  // todo: actually call this method
  limitByAlreadyWritten () {
    trace('limitByAlreadyWritten called')
    // todo: limit to a maximum number of lines to remove at once to avoid blocking the event loop
    while (!GlobalLineRingbuffer.isEmpty() && GlobalLineRingbuffer.peek()?.context?.payload == null) {
      const line = GlobalLineRingbuffer.deq()
      // and from the buffer
      LevelBuffers._deleteLineFromBuffer(line.context)
    }
  }

  /**
   * Removes log lines that are older than the specified maximum age.
   *
   * @param {number} maxLineAgeMs - The maximum age of log lines in milliseconds.
   */
  limitByMaxAge (maxLineAgeMs = this.maxLineAgeMs) {
    trace('limitByMaxAge called')
    const expiration = Date.now() - maxLineAgeMs

    // todo? handle async to avoid caller code delay
    while (!GlobalLineRingbuffer.isEmpty() && GlobalLineRingbuffer.peek()?.context?.timestamp < expiration) {
      // remove sequence index reference
      const line = GlobalLineRingbuffer.deq()
      // and from the buffer
      LevelBuffers._deleteLineFromBuffer(line.context)
      // todo? support expiration callback parameter for each line removed
    }
  }

  /**
   * Removes log lines that exceed the specified maximum line count.
   */
  limitByMaxCount () {} // automatic for ringbufferjs, triggers an optional eviction callback on overflow

  /**
   * Removes oldest log lines that exceed the specified maximum aggregate line byte size.
   */
  limitByMinFreeMemory (reservedAppBytes = 10 * 1024 * 1024, percentForHindsight = 0.5) {
    trace('limitByMinFreeMemory called')

    const { heap_size_limit: heapLimit, used_heap_size: usedHeap } = v8.getHeapStatistics()
    const logicalHeapFree = heapLimit - usedHeap

    // factor in configured limit and actual free memory
    const maxAvailableHeap = Math.min(logicalHeapFree, os.freemem())

    const bytesAvailable = maxAvailableHeap * percentForHindsight
    if (bytesAvailable > reservedAppBytes) {
      // there's enough free memory for the app, done here
      return
    }

    // how to prioritize which lines to remove? by level? by age? by size?
    // for now just trim the oldest lines from the sequence index
    // todo? support removal strategies like least-priority-first, completed-sessions-first, etc.
    let deqBatchCount = 200
    while (deqBatchCount-- > 0) {
      const line = GlobalLineRingbuffer.deq()

      // and this also reduces the estimated byte count
      LevelBuffers._deleteLineFromBuffer(line.context)
    }
  }
}

export default LevelBuffers

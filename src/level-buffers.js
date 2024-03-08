// src/level-buffers.js
import RingBuffer from 'ringbufferjs'
import sizeof from 'object-sizeof'
import LineBuffer from './line-buffer.js'

let sequenceIndex
let estimatedBytes = 0

class LevelBuffers {
  maxLineAgeMs
  maxBytes

  /**
   * Constructs a LevelBuffers object, initializing the global sequence index if required.
   * @param {Object} options - Configuration for the LevelBuffers object.
   * @param {number} options.maxLineCount - The maximum combined total line count.
   */
  constructor ({ maxLineCount, maxBytes = false }) {
    this.levels = {}
    this.maxBytes = maxBytes
    if (sequenceIndex == null) {
      LevelBuffers.initGlobalLineTracking(maxLineCount)
    }
  }

  // todo? getter for maxLineCount from sequenceIndex

  /**
   * Initializes the global index for buffers.
   * This function is also useful for clearing the static index during tests.
   *
   * @param {number} maxLineCount - The maximum combined total of all log lines.
   * @returns {void}
   */
  static initGlobalLineTracking (maxLineCount) {
    estimatedBytes = 0
    sequenceIndex = new RingBuffer( // init singleton on first constructor call
      maxLineCount, // max total of all log lines
      (line) => LevelBuffers._deleteLineFromBuffer(line.context) // eviction callback for last out lines
    )
  }

  // remove log line from the buffer referenced in the line's context object
  static _deleteLineFromBuffer (context) {
    const buffer = context.buffer
    estimatedBytes = Math.max(0, estimatedBytes - context.lineBytes) // stay >= 0

    buffer.delete(context.sequence)
  }

  static get estimatedBytes () { return estimatedBytes }

  get sequenceIndex () {
    return sequenceIndex // undefined if not initialized by constructor
  }

  /**
   * Retrieves the buffer for the specified level name. If the buffer does not exist, it will be created.
   *
   * @param {string} levelName - The name of the log level.
   * @returns {object} - The buffer object for the specified level name.
   */
  get (levelName) {
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
    const buffer = this.get(levelName)
    line.context.buffer = buffer // Add buffer and sequence to context as a back-reference when deleting lines
    line.context.sequence = buffer.add(line)

    if (this.maxBytes > 0) {
      try {
        const contextSize = Object.keys(line.context).length * 8 // rough estimate of line overhead
        line.context.lineBytes = sizeof(line.payload || []) + contextSize

        estimatedBytes += line.context.lineBytes
      } catch (e) {
        console.error(e)
        // todo: if circular reference error, use more expensive recursive sizeof with "object seen" map
        // ignore errors from sizeof for now
      }
    }

    // todo: figure out garbage collection for expired lines and the sequence index
    sequenceIndex.enq(line) // add to sequence index
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
  limitByAlreadyWritten () {
    // todo: limit to a maximum number of lines to remove at once to avoid blocking the event loop
    while (!sequenceIndex.isEmpty() && sequenceIndex.peek()?.context?.payload == null) {
      const line = sequenceIndex.deq()
      // and from the buffer
      LevelBuffers._deleteLineFromBuffer(line.context)
    }
  }

  /**
   * Removes log lines that are older than the specified maximum age.
   *
   * @param {number} maxLineAgeMs - The maximum age of log lines in milliseconds.
   */
  limitBymaxAge (maxLineAgeMs) {
    const expiration = Date.now() - maxLineAgeMs

    // todo? handle async to avoid caller code delay
    while (!sequenceIndex.isEmpty() && sequenceIndex.peek()?.context?.timestamp < expiration) {
      // remove sequence index reference
      const line = sequenceIndex.deq()
      // and from the buffer
      LevelBuffers._deleteLineFromBuffer(line.context)
      // todo? support expiration callback parameter for each line removed
    }
  }

  /**
   * Removes log lines that exceed the specified maximum line count.
   */
  limitBymaxSize () {} // automatic for ringbufferjs, triggers an optional eviction callback on overflow

  /**
   * Removes oldest log lines that exceed the specified maximum aggregate line byte size.
   */
  limitBymaxBytes () {
    // how to prioritize which lines to remove? by level? by age? by size?
    // for now just trim the oldest lines from the sequence index
    // todo? support removal strategies like least-priority-first, completed-sessions-first, etc.
    while (estimatedBytes > this.maxBytes && sequenceIndex.size() > 0) {
      const line = sequenceIndex.deq()

      // and this also reduces the estimated byte count
      LevelBuffers._deleteLineFromBuffer(line.context)
    }
  }
}

export default LevelBuffers

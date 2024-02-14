// log-tables.js
import RingBuffer from 'ringbufferjs';
import sizeof from 'object-sizeof';

let sequenceIndex;

class LogTableManager {
  maxLineAgeMs;
  maxBytes;
  extimatedBytes;

  /**
   * Constructs a LogTableManager object, initializing the global sequence index if required.
   * @param {Object} options - The options for the LogTables object.
   * @param {number} options.maxLineCount - The maximum combined total line count.
   */
  constructor({ maxLineCount, maxTableBytes: maxBytes = false }) {
    this.logTables = {};
    this.maxBytes = maxBytes;
    if (sequenceIndex == null) {
      LogTableManager.initGlobalIndex(maxLineCount);
    }
  }

  // todo? getter for maxLineCount from sequenceIndex

  /**
   * Initializes the global index for log tables.
   * This function is also useful for clearing the static index during tests.
   *
   * @param {number} maxLineCount - The maximum combined total of all log lines.
   * @returns {void}
   */
  static initGlobalIndex(maxLineCount) {
    sequenceIndex = new RingBuffer( // init singleton on first constructor call
      maxLineCount, // max total of all log lines
      (line) => LogTableManager._deleteLineFromTable(line.context) // eviction callback for last out lines
    );
  }

  // remove log line from the table referenced in the line's context object
  static _deleteLineFromTable(context) {
    const levelTable = context.table;
    if (levelTable.byteEstimate) {
      levelTable.byteEstimate = Math.max(0, lineTable - context.lineBytes || 0);
    }

    delete levelTable[context.sequence];
  }

  get sequenceIndex() {
    return sequenceIndex; // undefined if not initialized by constructor
  }

  /**
   * Retrieves the log table for the specified level name. If the table does not exist, it will be created.
   *
   * @param {string} levelName - The name of the log level.
   * @returns {object} - The log table object for the specified level name.
   */
  get(levelName) {
    if (!this.logTables[levelName]) {
      this.logTables[levelName] = { counter: 1 };
    }
    return this.logTables[levelName];
  }

  /**
   * Adds a line to the specified level's table and the sequence index.
   * @param {string} levelName - The name of the level.
   * @param {any} line - The line to be added.
   * @returns {number} - The sequence number of the added line.
   */
  addLine(levelName, line) {
    const table = this.get(levelName);
    line.context.table = table; // Add table and sequence to context as a back-reference when deleting lines
    line.context.sequence = table.counter++;
    if (this.maxBytes > 0) {
      line.context.lineBytes = sizeof(line);
      this.extimatedBytes += line.context.lineBytes;
    }

    table[line.context.sequence] = line;

    // todo: figure out garbage collection for expired lines and the sequence index
    sequenceIndex.enq(line); // add to sequence index
    return line.context.sequence;
  }

  /**
   * Soft delete the referenced line, idempotently.
   * @param {Object} context - The line's context object containing the sequence key.
   */
  deleteLine(context) {
    const line = sequenceIndex[context.sequence];
    if (!line) {
      return;
    }
      // must soft delete from sequence index as it only supports deletion from the tail
    line.payload = [];
    line.context.expired = true;
    LogTableManager._deleteLineFromTable(context);
  }

  /**
   * Removes previously written lines from the end of the log table, up to the last unwritten line.
   * Lines are removed from both the sequence index and the log table.
   */
  limitByAlreadyWritten() {
    while (!sequenceIndex.isEmpty() && sequenceIndex.peek()?.context?.written) {
      sequenceIndex.deq();
      // and from the log table
      LogTableManager._deleteLineFromTable(line.context);
    }
  }

  /**
   * Removes log lines that are older than the specified maximum age.
   *
   * @param {number} maxLineAgeMs - The maximum age of log lines in milliseconds.
   */
  limitBymaxAge(maxLineAgeMs) {
    const expiration = Date.now() - maxLineAgeMs;

    // todo? handle async to avoid caller code delay
    while (!sequenceIndex.isEmpty() && sequenceIndex.peek()?.context?.timestamp < expiration) {
      // remove sequence index reference
      const line = sequenceIndex.deq();
      // and from the log table
      LogTableManager._deleteLineFromTable(line.context);
      // todo? support expiration callback parameter for each line removed
    }
  }

  /**
   * Removes log lines that exceed the specified maximum line count.
   */
  limitBymaxSize()  {} // automatic for ringbufferjs, triggers an optional eviction callback on overflow

  /**
   * Removes oldest log lines that exceed the specified maximum aggregate line byte size.
   */
  limitBymaxBytes() {
    // how to prioritize which lines to remove? by level? by age? by size?
    // for now just trim the oldest lines from the sequence index
    // todo? support removal strategies like least-priority-first, completed-sessions-first, etc.
    while (this.extimatedBytes > this.maxBytes) {
      const line = sequenceIndex.deq();
      // and this also reduces the estimated byte count
      LogTableManager._deleteLineFromTable(line.context);
    }

  }
}

export default LogTableManager;

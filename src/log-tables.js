// log-tables.js
import RingBuffer from 'ringbufferjs';

let sequenceIndex;

class LogTableManager {
  maxLineAgeMs;

  constructor({ maxLineCount }) {
    this.logTables = {};
    if (sequenceIndex == null) {
      LogTableManager.initGlobalIndex(maxLineCount);
    }
  }

  static initGlobalIndex(maxLineCount) {
    sequenceIndex = new RingBuffer( // init singleton on first constructor call
      maxLineCount, // max total of all log lines
      (line) => LogTableManager._deleteLineFromTable(line.context) // eviction callback for last out lines
    );
  }

  static _deleteLineFromTable(context) {
    const levelTable = context.table;
    delete levelTable[context.sequence];
  }

  get sequenceIndex() {
    return sequenceIndex; // undefined if not initialized by constructor
  }

  get(levelName) {
    if (!this.logTables[levelName]) {
      this.logTables[levelName] = { counter: 1 };
    }
    return this.logTables[levelName];
  }

  addLine(levelName, line) {
    const table = this.get(levelName);
    line.context.table = table; // Add table and sequence to context as a back-reference when trimming
    line.context.sequence = table.counter++;;
    table[line.context.sequence] = line;

    // todo: figure out garbage collection for expired lines and the sequence index
    sequenceIndex.enq(line); // add to sequence index
    return line.context.sequence;
  }

  deleteLine(context) {
    const line = sequenceIndex[context.sequence];
    if (!line) {
      // must soft delete from sequence index as it only supports deletion from the tail
      line.payload = [];
      line.context.written = true;
    }
    LogTableManager._deleteLineFromTable(context);
  }

  trimBylineCountAbove() {
    // no-op for the ringbufferjs as it maintains max size and triggers the eviction callback when full
    // todo? implement a manual buffer length override for the sequence index / truncate current contents
  }

  // call this via setTimeout to avoid caller code delay
  trimBylineOlderThanMs(maxLineAgeMs) {
    const oldestAllowed = Date.now() - maxLineAgeMs;

    while (sequenceIndex.peek().context.timestamp < oldestAllowed) {
      // remove line from table
      const line = sequenceIndex.peek();

      // remove line from other structures
      LogTableManager._deleteLineFromTable(line.context);

      // remove sequence index reference
      sequenceIndex.deq();
      // todo: support expiration callback for each line removed?
    }
  }
}

export default LogTableManager;

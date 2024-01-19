// log-tables.js
import RingBuffer from 'ringbufferjs';

class LogTableManager {
  indices;
  maxLineAgeMs;

  constructor({ maxLineCount }) {
    this.logTables = {};
    this.indices = {
      sequence: new RingBuffer(
        maxLineCount, // max total of all log lines
        (line) => this._deleteLineFromTable(line.context) // eviction callback for when buffer is full
      )
    };
  }

  get(levelName) {
    if (!this.logTables[levelName]) {
      this.logTables[levelName] = { counter: 1 };
    }
    return this.logTables[levelName];
  }

  addLine(levelName, line) {
    const table = this.get(levelName);
    const sequence = table.counter++;
    line.context.sequence = sequence; // Add sequence to context as a back-reference when trimming
    table[sequence] = line;

    this.indices.sequence.enq(line); // add to sequence index
    return sequence;
  }

  deleteLine(context) {
    const line = this.indices.sequence[context.sequence];
    if (!line) {
      // must soft delete from sequence index as it only supports deletion from the tail
      line.payload = [];
      line.context.written = true;
    }
    this._deleteLineFromTable(context);
  }

  _deleteLineFromTable(context) {
    const levelTable = this.get(context.name);
    delete levelTable[context.sequence];
  }

  trimBylineCountAbove() {
    // no-op for the ringbufferjs as it maintains max size and triggers the eviction callback when full
    // todo: implement a manual buffer length override for the sequence index / truncate current contents
  }

  // call this via setTimeout to avoid caller code delay
  trimBylineOlderThanMs(maxLineAgeMs) {
    const oldestAllowed = Date.now() - maxLineAgeMs;

    while (this.indices.sequence.peek().context.timestamp < oldestAllowed) {
      // remove line from table
      const line = this.indices.sequence.peek();

      // remove line from other structures
      this._deleteLineFromTable(line.context);

      // remove sequence index reference
      this.indices.sequence.deq();
      // todo: support expiration callback for each line removed?
    }
  }
}

export default LogTableManager;

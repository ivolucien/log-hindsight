// log-tables.js

class LogTableManager {
  constructor() {
      this.logTables = {};
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
      return sequence;
  }

  // Additional methods like trim, getLogEntries, etc., can be added here
}

export default LogTableManager;

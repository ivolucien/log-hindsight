import getScopedLoggers from './internal-loggers.js'
const { trace } = getScopedLoggers('line-buffer')

/**
 * LineBuffer class for storing log lines with array-like auto-incrementing key.
 */
class LineBuffer {
  /**
   * Initializes a new instance of the LineBuffer class.
   */
  constructor () {
    this.lines = new Map()
    this.index = 0 // Initialize the counter (index) for auto-incrementing keys
  }

  /**
   * Adds a log line to the buffer.
   * @param {any} line - The log line to add to the buffer.
   * @returns {number} The index of the added log line.
   */
  add (line) {
    trace('add called')
    const currentIndex = this.index
    this.lines.set(currentIndex, line)
    this.index++
    return currentIndex
  }

  /**
   * Retrieves a log line by its index.
   * @param {number} index - The index of the log line to retrieve.
   * @returns {any} The log line at the specified index.
   */
  get (index) {
    return this.lines.get(index)
  }

  /**
   * Deletes a log line by its index.
   * @param {number} index - The index of the log line to delete.
   * @returns {boolean} True if the log line was successfully deleted, false otherwise.
   */
  delete (index) {
    trace('delete called')
    return this.lines.delete(index)
  }

  /**
   * Gets the current size of the log lines buffer.
   * @returns {number} The number of log lines in the buffer.
   */
  get size () {
    return this.lines.size
  }

  /**
   * Clears all log lines from the buffer.
   */
  clear () {
    trace('clear called')
    this.lines.clear()
    this.index = 0 // Reset the index after clearing the buffer
  }
}

export default LineBuffer

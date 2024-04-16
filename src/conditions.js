// ./src/conditions.js
import getScopedLoggers from './internal-loggers.js'
const { trace } = getScopedLoggers('conditions')

export default class ConditionFactory {
  // all created conditions are bound to the Hindsight instance on writeWhen assignment

  // if passed an error log line, the returned `writeWhen` function will always write all buffered lines
  static createDumpOnError (retroactiveLevelCutoff) {
    return (metadata) => {
      const isError = this.toInt(metadata.level) >= this.toInt('error')
      if (isError) {
        trace('dumpOnError triggered')
        this.writeIf(retroactiveLevelCutoff) // write all of instance's buffered lines not below cutoff
      }
      return true // this writes the error line regardless of the overall cutoff level
    }
  }

  // creates function returning true for every N lines or if allowed by its level, otherwise 'buffer'
  static createOnEveryNth (countInterval) {
    return (metadata) => {
      this.lineCounter ? this.lineCounter += 1 : this.lineCounter = 1 // initialize or increment
      const isNth = this.lineCounter % countInterval === 1

      const belowCutoff = this.toInt(metadata.level) < this.toInt(this.writeWhen.level)

      if (isNth) {
        trace('onEveryNth triggered', { lineCount: this.lineCounter })
      }
      return !belowCutoff || isNth
    }
  }

  // creates function returning 'write' if function parameter returns a level not above the line level
  // this example is a little redundant since the user can define a custom function for `writeWhen`
  static createOnDynamicLevel (getDynamicLevel = (/* metadata, lineArgs */) => this.writeWhen.level) {
    return (metadata, lineArgs) => {
      const effectiveLevel = getDynamicLevel(metadata, lineArgs) // return level string based on caller's logic

      const belowCutoff = this.toInt(metadata.level) < this.toInt(effectiveLevel)
      return !belowCutoff
    }
  }
}

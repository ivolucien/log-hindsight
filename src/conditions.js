import getScopedLoggers from './internal-loggers.js'
const { trace } = getScopedLoggers('conditions')

export default class ConditionFactory {
  // all created conditions are bound to the Hindsight instance on writeWhen assignment

  static createDumpOnError (instance, retroactiveLevelCutoff) {
    const condition = (metadata) => {
      const isError = instance.toInt(metadata.level) >= instance.toInt('error')
      if (isError) {
        trace('dumpOnError triggered')
        instance.writeIf(retroactiveLevelCutoff) // write all of instance's buffered lines not below cutoff
      }
      return true // this writes the error line regardless of the overall cutoff level
    }
    return condition.bind(instance) // Bind `condition` to `instance`
  }

  static createOnEveryNth (instance, countInterval) {
    const condition = (metadata) => {
      // initialize or increment a line counter for test purposes
      instance.lineCounter = instance.lineCounter ? instance.lineCounter + 1 : 1
      const isNth = instance.lineCounter % countInterval === 1

      const belowCutoff = instance.toInt(metadata.level) < instance.toInt(instance.writeWhen.level)

      if (isNth) {
        trace('onEveryNth triggered', { lineCount: instance.lineCounter })
      }
      return !belowCutoff || isNth
    }
    return condition.bind(instance) // Bind `condition` to `instance`
  }

  /**
   * Creates a condition that checks if the dynamic level returned is below the cutoff.
   *
   * @param {Object} instance - The Hindsight instance.
   * @param {Function} getDynamicLevel - The user defined function that returns the dynamic level.
   * @returns {Function} - The condition function.
   *
   * Returned condition function.
   * @param {Object} metadata - The metadata object.
   * @param {Array} lineArgs - The line arguments.
   * @return {Boolean} Returns true if the dynamic level is at or above the cutoff, else false.
   */
  static createOnDynamicLevel (instance, getDynamicLevel) { // (metadata, lineArgs) => <code returning level string> */) {
    const condition = (metadata, lineArgs) => {
      const effectiveLevel = getDynamicLevel(metadata, lineArgs) // return level string based on caller's logic

      const belowCutoff = instance.toInt(metadata.level) < instance.toInt(effectiveLevel)
      return !belowCutoff
    }
    return condition.bind(instance) // Bind `condition` to `instance`
  }
}

// File: ./src/tests/hindsight-filterData.test.js
import { expect } from 'chai'
import Hindsight from '../index.js' // Adjusted import path based on file location

describe('Hindsight filterData functionality', () => {
  it('should apply a shallow copy of log line args by default', () => {
    const hindsight = new Hindsight({
      logger: console,
      writeWhen: { level: 'warn' } // Ensure that debug messages are buffered
    })

    const originalArgs = [{ nested: { key: 'value' } }, ['array'], 'string', 123]
    hindsight.debug(...originalArgs)

    const bufferedLine = hindsight.buffers.get('debug').get(0)
    console.dir(bufferedLine)
    expect(bufferedLine.payload).to.eql(originalArgs) // Checks for deep equality in value
    expect(bufferedLine.payload[0]).to.not.equal(originalArgs[0]) // top level params cloned
    expect(bufferedLine.payload[0].nested).to.equal(originalArgs[0].nested) // nested params not cloned
  })

  it('should apply a custom filterData function to log line args', () => {
    const customFilter = (args) => args.map(arg => typeof arg === 'string' ? arg.toUpperCase() : arg)
    const hindsight = new Hindsight({
      logger: console,
      writeWhen: { level: 'warn' }, // Ensure that debug messages are buffered
      filterData: customFilter
    })

    const originalArgs = ['first', 'second', 123]
    hindsight.debug(...originalArgs)

    const bufferedLine = hindsight.buffers.get('debug').get(0)
    expect(bufferedLine.payload).to.eql(['FIRST', 'SECOND', 123]) // Value equality after transformation
  })

  it('should handle complex objects with custom filterData function', () => {
    const customFilter = (args) => args.map(arg => {
      if (typeof arg === 'object' && !Array.isArray(arg)) {
        return { ...arg, filtered: true } // Modify objects by adding a property
      }
      return arg
    })
    const hindsight = new Hindsight({
      logger: console,
      writeWhen: { level: 'warn' }, // Ensure that debug messages are buffered
      filterData: customFilter
    })

    const originalArgs = [{ key: 'value' }, ['array'], 'string']
    hindsight.debug(...originalArgs)

    const bufferedLine = hindsight.buffers.get('debug').get(0)
    expect(bufferedLine.payload[0]).to.eql({ key: 'value', filtered: true }) // Checks modified object for value equality
    expect(bufferedLine.payload[1]).to.equal(originalArgs[1]) // Reference equality for arrays
    expect(bufferedLine.payload[2]).to.equal(originalArgs[2]) // Reference equality for strings
  })
})

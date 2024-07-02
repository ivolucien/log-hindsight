import { expect } from 'chai'
import { safeStringifyToDepth } from '../tools.js'

describe('safeStringifyToDepth', function () {
  it('should handle all supported data types correctly', function () {
    const date = new Date()
    const error = new Error('test error')
    const func = function () {}
    const regex = /test/
    const symbol = Symbol('test')

    const obj = {
      date,
      error,
      func, // functions dropped from output
      regex,
      symbol,
      string: 'test',
      number: 123,
      boolean: true,
      nullValue: null
    }

    const result = safeStringifyToDepth(obj)

    expect(result).to.equal(
      '{"date":"' + date.toISOString() +
      '","error":{},"regex":"/test/","string":"test","number":123,"boolean":true,"nullValue":null}'
    )
  })

  it('should handle unsupported data types as generic objects', function () {
    const bigint = BigInt(123)
    const buffer = Buffer.from('test')

    const obj = {
      bigint,
      buffer
    }

    const result = safeStringifyToDepth(obj, 2)

    expect(result).to.equal(
      '{"bigint":"123","buffer":{"0":116,"1":101,"2":115,"3":116}}'
    )
  })

  it('should handle edge cases correctly', function () {
    const emptyArray = []
    const emptyObject = {}
    const nullValue = null

    const result = safeStringifyToDepth({
      emptyArray,
      emptyObject,
      nullValue
    })

    expect(result).to.equal('{"emptyArray":[],"emptyObject":{},"nullValue":null}')
  })

  it('should enforce depth limit', function () {
    const obj = {
      level1: {
        level2: {
          level3: {
            level4: 'too deep'
          }
        }
      }
    }

    const result = safeStringifyToDepth(obj, 3)

    expect(result).to.equal('{"level1":{"level2":{"level3":"[Truncated]"}}}')
  })

  it('should handle circular references', function () {
    const obj = {}
    obj.self = obj

    const result = safeStringifyToDepth(obj)

    expect(result).to.equal('{"self":"[Circular]"}')
  })

  it('should handle arrays with length limit', function () {
    const array = new Array(20).fill(1)

    const result = safeStringifyToDepth(array, 3, 10)

    expect(result).to.equal('[1,1,1,1,1,1,1,1,1,1,"[Truncated]"]')
  })

  it('should handle errors gracefully', function () {
    const forceErrorRegExp = /./
    const original = forceErrorRegExp.toString
    forceErrorRegExp.toString = function () { throw new Error('force Error') }
    let result
    try {
      result = safeStringifyToDepth({ a: forceErrorRegExp }, 3, 10, 0, forceErrorRegExp)
    } finally {
      forceErrorRegExp.toString = original
    }

    expect(result).to.include('Error: safeStringifyToDepth')
  })

  it('should handle special edge cases', function () {
    const obj = {
      emptyString: '',
      zero: 0,
      falseValue: false,
      undefinedValue: undefined // should drop this from output
    }

    const result = safeStringifyToDepth(obj)

    expect(result).to.equal('{"emptyString":"","zero":0,"falseValue":false}')
  })

  it('should stringify non-string scalars correctly', function () {
    const obj = {
      string: 'test',
      number: 123,
      boolean: true,
      nullValue: null
    }

    const result = safeStringifyToDepth(obj, 3)

    expect(result).to.equal('{"string":"test","number":123,"boolean":true,"nullValue":null}')
  })

  it('should handle symbols in objects', function () {
    const sym = Symbol('test')
    const obj = {
      [sym]: 'symbolValue',
      inner: { [sym]: 'innerSymbolValue' }
    }

    const result = safeStringifyToDepth(obj, 3)

    expect(result).to.equal('{"inner":{}}') // Symbols are not enumerable
  })

  it('should handle very large objects', function () {
    const largeObj = {}
    for (let i = 0; i < 10000; i++) {
      largeObj[`key${i}`] = i
    }

    const result = safeStringifyToDepth(largeObj, 2)

    expect(result).to.include('"key9999":9999') // Check some values to ensure it's processed
  })

  it('should handle deeply nested arrays', function () {
    const arr = [1, [2, [3, [4, [5]]]]]

    const result = safeStringifyToDepth(arr, 3)

    expect(result).to.equal('[1,[2,[3,"[Truncated]"]]]')
  })

  it('should handle functions in nested structures', function () {
    const obj = {
      a: 1,
      b: { c: function () {}, d: { e: 'text' } }
    }

    const result = safeStringifyToDepth(obj, 3)

    expect(result).to.equal('{"a":1,"b":{"d":{"e":"text"}}}')
  })

  it('should handle mixed structures', function () {
    const obj = {
      a: [1, 2, 3],
      b: { c: new Date(), d: /regex/, e: Symbol('test') }
    }

    const result = safeStringifyToDepth(obj, 3)

    expect(result).to.equal('{"a":[1,2,3],"b":{"c":"' + obj.b.c.toISOString() + '","d":"/regex/"}}')
  })

  it('should handle objects with excessive depth', function () {
    const deepObj = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } }

    const result = safeStringifyToDepth(deepObj, 4)

    expect(result).to.equal('{"a":{"b":{"c":{"d":"[Truncated]"}}}}')
  })
})

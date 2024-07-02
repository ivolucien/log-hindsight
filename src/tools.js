// shared tools for log-hindsight

export function simplifyToDepth (value, maxDepth = 3, maxArrayLength = 10, depth = 0, seen = new WeakMap()) {
  try {
    const type = typeof value
    if ((type !== 'object' && type !== 'bigint') || value instanceof Error || value === null) {
      return value
    }

    if (value instanceof Date) {
      return new Date(value.getTime())
    }

    if (type === 'function') {
      return '[Function]'
    }

    if (value instanceof RegExp || type === 'symbol' || type === 'bigint') {
      return value.toString()
    }

    if (depth >= maxDepth) {
      return '[Truncated]' // truncate objects and containers at maxDepth
    }

    if (seen.has(value)) {
      return '[Circular]'
    }

    seen.set(value, true)

    if (Array.isArray(value)) {
      const copy = new Array(Math.min(maxArrayLength, value.length))
      for (let i = 0; i < copy.length; i++) {
        copy[i] = simplifyToDepth(value[i], maxDepth, maxArrayLength, depth + 1, seen)
      }
      if (value.length > copy.length) {
        copy.push('[Truncated]')
      }
      seen.delete(value)
      return copy
    }

    if (value instanceof Map) {
      const copy = new Map()
      for (const [key, val] of value.entries()) {
        copy.set(key, simplifyToDepth(val, maxDepth, maxArrayLength, depth + 1, seen))
      }
      seen.delete(value)
      return copy
    }

    if (value instanceof Set) {
      const copy = new Set()
      for (const item of value.values()) {
        copy.add(simplifyToDepth(item, maxDepth, maxArrayLength, depth + 1, seen))
      }
      seen.delete(value)
      return copy
    }

    const copy = {} // treat as generic object
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        copy[key] = simplifyToDepth(value[key], maxDepth, maxArrayLength, depth + 1, seen)
      }
    }

    seen.delete(value)

    return copy
  } catch (e) {
    return `Error: safeStringifyToDepth (depth ${depth}): ` + (e?.message ?? '[no error message]')
  }
}

export function safeStringifyToDepth (value, maxDepth = 3, maxArrayLength = 10) {
  const simplified = simplifyToDepth(value, maxDepth, maxArrayLength)
  return JSON.stringify(simplified)
}

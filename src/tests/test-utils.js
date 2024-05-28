import Hindsight from '../index.js'
import sizeof from 'object-sizeof'
import { performance } from 'perf_hooks'

let uniquenessCount = 0
let stats = {}
let logArgBytes = 0

// string of chosen count of repeated 'testing, 123 '
function generateRandomString (copies) {
  return 'testing, 123 '.repeat(copies) + uniquenessCount++
}

// generate random log arguments using semi-random strings and objects
function generateLogArgs () {
  const argCount = Math.ceil(Math.random() * 6)
  return Array.from({ length: argCount }, () => {
    if (Math.random() > 0.5) {
      const copies = Math.ceil(Math.random() * 10)
      const str = generateRandomString(copies)
      logArgBytes += sizeof(str)
      return str
    } else {
      const propCount = Math.ceil(Math.random() * 5)
      const obj = {}
      for (let i = 0; i < propCount; i++) {
        const copies = Math.ceil(Math.random() * 5)
        obj[generateRandomString(1)] = generateRandomString(copies)
      }
      logArgBytes += sizeof(obj)
      return obj
    }
  })
}

// log lines using a statically reasonable distribution of log levels
function skewedRandomLog (hindsight, ...logArguments) {
  const rand = Math.random()
  const level = rand < 0.5
    ? 'trace'
    : rand < 0.75
      ? 'debug'
      : rand < 0.9
        ? 'info'
        : 'warn'
  try {
    hindsight[level](...logArguments)
  } catch (error) {
    console.error(error)
  }
}

// run a user session with random log lines and delays in between
async function runUserSession (config, logLineCount) {
  try {
    const startGet = performance.now()
    const hindsightInstance = Hindsight.getOrCreateChild(config)
    stats.minGetOrCreate = Math.min(stats.minGetOrCreate, performance.now() - startGet)
    stats.maxGetOrCreate = Math.max(stats.maxGetOrCreate, performance.now() - startGet)
    for (let i = 0; i < logLineCount; i++) {
      const startLog = performance.now()
      skewedRandomLog(hindsightInstance, ...generateLogArgs())
      stats.minLogLine = Math.min(stats.minLogLine, performance.now() - startLog)
      stats.maxLogLine = Math.max(stats.maxLogLine, performance.now() - startLog)
      // random delay between log lines
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 21)))
      if (uniquenessCount % 10000 === 0) {
        console.log({
          lineArgBytes: logArgBytes.toLocaleString(),
          lineCount: hindsightInstance.buffers.GlobalLineRingbuffer.size().toLocaleString(),
          memoryStats: process.memoryUsage()
        })
      }
    }
  } catch (error) {
    console.error(error)
  }
}

// run the specified number of user requests over a specified duration
async function runUserRequests (requestCount, runDuration) {
  if (requestCount <= 0 || runDuration <= 0) return // bail if nothing to do
  stats = { minGetOrCreate: 10000, maxGetOrCreate: -1, minLogLine: 10000, maxLogLine: -1 }

  const sessionId = generateRandomString(1)
  const startTime = Date.now()
  while (Date.now() - startTime < runDuration) {
    const userConfig = { perLineFields: { sessionId } }
    runUserSession(userConfig, Math.floor(Math.random() * 100) + 1, userConfig)
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 91) + 10)) // configurable?
    if (--requestCount <= 0) break
  }
  return Date.now() // end of user activity
}

export { generateLogArgs, skewedRandomLog, runUserSession, runUserRequests, stats }

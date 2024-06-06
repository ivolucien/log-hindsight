import Hindsight from '../index.js'
import sizeof from 'object-sizeof'
import { performance } from 'perf_hooks'

let uniquenessCount = 0
let stats = {}
let logArgBytes = 0

// these constants are the maximum random values for each parameter, e.g. 0 to 100
const LOG_MS = 100
const LINES = 100
const USER_MS = 100

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

function getMaxMs (old, start) {
  // performance ms rounded to 1000th of a millisecond
  return Math.max(old, Math.round((performance.now() - start) * 1000) / 1000)
}
// run a user session with random log lines and delays in between
async function runUserSession (config, logLineCount) {
  try {
    const startGet = performance.now()
    const hindsightInstance = Hindsight.getOrCreateChild(config)
    stats.maxGetOrCreate = getMaxMs(stats.maxGetOrCreate, startGet)
    for (let i = 0; i < logLineCount; i++) {
      const startLog = performance.now()
      skewedRandomLog(hindsightInstance, ...generateLogArgs())
      stats.maxLogLine = Math.max(stats.maxLogLine, performance.now() - startLog)
      // random delay between log lines
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * LOG_MS)))
      if (uniquenessCount % 100000 === 0) {
        const memUse = process.memoryUsage()
        console.log({
          lineArgBytes: logArgBytes.toLocaleString(),
          lineCount: LevelBuffers.totalLineCount.toLocaleString(),
          memoryStats: Object.fromEntries(Object.entries(memUse)
            .map(([key, value]) => [key, `${value / 1000000} MB`]))
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
  stats = { maxGetOrCreate: -1, maxLogLine: -1 }

  const sessionId = generateRandomString(1)
  const startTime = Date.now()
  while (Date.now() - startTime < runDuration) {
    const userConfig = { perLineFields: { sessionId } }
    runUserSession(userConfig, Math.floor(Math.random() * LINES) + 1, userConfig)
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * USER_MS) + 10)) // configurable?
    if (--requestCount <= 0) break
  }
  return Date.now() // end of user activity
}

function logMemoryUsage () {
  const instances = Hindsight.getInstances()
  const trackedInstanceCount = instances.size
  const totalMemory = Array.from(instances.values())
    .reduce((bytes, instance) => bytes + sizeof(instance), 0)

  const instanceSizes = Array.from(instances.entries()).map(([key, instance]) => ({
    key,
    size: sizeof(instance)
  }))

  instanceSizes.sort((a, b) => b.size - a.size)

  console.log(`Total estimated memory usage: ${totalMemory / 1000} KB`)
  console.log(`Largest instances by size, of ${trackedInstanceCount}:`)
  instanceSizes.slice(0, 5).forEach(instance => {
    console.log(`${instance.key}: ${instance.size / 1000} KB `)
  })
}

export { generateLogArgs, skewedRandomLog, runUserSession, runUserRequests, stats, logMemoryUsage }

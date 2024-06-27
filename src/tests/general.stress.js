import Hindsight from '../index.js'
import ObjectCache from '../object-cache.js'
import LevelBuffers from '../level-buffers.js'
import { logMemoryUsage, runUserRequests, stats } from './test-utils.js'
import sizeof from 'object-sizeof'

// Constants for test configuration, tuned for 1.5GB heap size
const MAX_USER_COUNT = 200
const TEST_DURATION = 130000
const MIN_SESSION_DURATION = 30000
const MAX_SESSION_DURATION = 70000
const RAMP_TIME = 10000 // 10 seconds in milliseconds

describe('General Stress Test', function () {
  this.timeout(TEST_DURATION + 120 * 1000) // Set timeout longer than the test duration
  const start = Date.now()
  let preTestLineCreation = 0

  beforeEach(() => {
    ObjectCache.initSingletonTracking({})
    preTestLineCreation = LevelBuffers.GlobalLineRingbuffer?.size() || 0
    console.log({ preTestLineCreation, diagnosticStats: Hindsight.getDiagnosticStats() })
  })

  this.afterEach(() => {
    const durationS = (Date.now() - start) / 1000
    console.log({
      durationS,
      netTestLineCreation: LevelBuffers.GlobalLineRingbuffer?.size() - preTestLineCreation
    })
  })

  it('should handle user requests over a sustained period without error', async function () {
    const startTime = Date.now()
    const users = Array(MAX_USER_COUNT).fill(null)
    let usersStarted = 1

    // Function to start user sessions
    const startUserSessions = () => {
      console.log('startUserSessions: called')
      const currentTime = Date.now()
      const elapsedTime = currentTime - startTime
      usersStarted = Math.min(MAX_USER_COUNT, Math.floor((elapsedTime / RAMP_TIME) * MAX_USER_COUNT))

      for (let i = 0; i < usersStarted; i++) {
        if (users[i]?.userEnd) {
          const testTime = users[i].userEnd - users[i].userStart
          console.log(`User ${i} complete after ${Math.floor(testTime / 1000)} s`)
          users[i] = null
        }
        if (!users[i]) {
          // session duration, don't go beyond the overall test duration
          const sessionDuration = Math.min(
            MIN_SESSION_DURATION + Math.floor(Math.random() * (MAX_SESSION_DURATION - MIN_SESSION_DURATION)),
            TEST_DURATION - (currentTime - startTime)
          )

          if (sessionDuration > 0) {
            users[i] = { userStart: Date.now() }
            const requestCount = Math.floor(Math.random() * 200) + 1
            runUserRequests(requestCount, sessionDuration) // Start user requests without awaiting
              .then((end) => {
                users[i].userEnd = end
              })
          }
        }
      }
    }

    // Schedule periodic updates
    const intervalId = setInterval(() => {
      startUserSessions()
      let activeSessions = 0

      // Print status of each user's requests
      users.forEach((session, index) => {
        if (session && !session.userEnd) {
          activeSessions++
          const elapsed = Date.now() - session.userStart
          if (elapsed >= TEST_DURATION) {
            users[index] = null // Reset the session if time is exceeded
          }
        }
      })
      console.log(
        `Active users: ${activeSessions} @ ${(Date.now() - startTime) / 1000}s elapsed`,
        stats,
        Hindsight.getDiagnosticStats()
      )
    }, 10 * 1000)

    // Wait until the test duration has passed
    await new Promise(resolve => setTimeout(resolve, TEST_DURATION))
    // Cleanup
    clearInterval(intervalId)
    logMemoryUsage()
    await new Promise(resolve => setTimeout(resolve, 5000))
    async function logAndWait () {
      let referencedFirstLineCount = 0
      let reapedLineCount = 0
      const weakRefs = LevelBuffers.getFirstLineWeakRefs()
      for (const weakRef of weakRefs) {
        weakRef.line.deref() ? referencedFirstLineCount++ : reapedLineCount++
      }
      console.log(
        'Overall test duration: ', (Date.now() - start) / 1000 + 's',
        {
          referencedFirstLineCount,
          reapedLineCount,
          discrepancy: weakRefs.length - (referencedFirstLineCount + reapedLineCount)
        }
      )
      await new Promise(resolve => setTimeout(resolve, 10 * 1000))
    }

    function logAndKillInstances () {
      const globalInstances = ObjectCache.getInstances()

      const stats = {
        fullStatsCount: 0,
        instanceCount: globalInstances.size,
        bufferCount: 0,
        lineCount: 0,
        payloadCount: 0,
        approxTotalBytes: 0,
        ...Hindsight.getDiagnosticStats()
      }
      globalInstances.forEach(instance => {
        if (instance?.buffers?.levels == null) {
          return
        }
        try {
          stats.bufferCount += Object.keys(instance.buffers.levels).length || 0
          stats.fullStatsCount++
          Object.values(instance.buffers.levels).forEach(buff => {
            stats.lineCount += buff?.lines?.size || 0
            buff?.lines?.forEach(line => {
              stats.payloadCount += line.payload?.length <= 0 ? 0 : 1
            })
          })
          stats.approxTotalBytes += sizeof(instance)
          instance.delete()
        } catch (error) {
          console.error(error)
        }
      })
      console.dir({ stats })
    }
    console.log('End of stress test, killing all Hindsight instances')
    logAndKillInstances()
    await logAndWait()
    ObjectCache.cleanupExpiredInstances()
    await logAndWait()
    await logAndWait()
    await logAndWait()
    await logAndWait()
    await logAndWait()
    logAndKillInstances()
    await logAndWait()
    await logAndWait()
    await logAndWait()
    await new Promise(resolve => setTimeout(resolve, 1000))
  })
})

import Hindsight from '../index.js'
import { runUserRequests, stats } from './test-utils.js'
import sizeof from 'object-sizeof'

// Constants for test configuration
const MAX_USER_COUNT = 200
const TEST_DURATION = 130000
const MIN_SESSION_DURATION = 30000
const MAX_SESSION_DURATION = 70000
const RAMP_TIME = 10000 // 10 seconds in milliseconds

function logMemoryUsage () {
  const instances = Hindsight.getInstances()
  const totalMemory = Array.from(instances.values())
    .reduce((bytes, instance) => bytes + sizeof(instance.buffers), 0)

  const instanceSizes = Array.from(instances.entries()).map(([key, instance]) => ({
    key,
    size: sizeof(instance)
  }))

  instanceSizes.sort((a, b) => b.size - a.size)

  console.log(`Total estimated memory usage: ${totalMemory / 1000} KB`)
  console.log('Largest 10 instances by size:')
  instanceSizes.slice(0, 10).forEach(instance => {
    console.log(`${instance.key}: ${instance.size / 1000} KB `)
  })
}

describe('General Stress Test', function () {
  this.timeout(TEST_DURATION + 5000) // Set timeout longer than the test duration

  this.beforeEach(() => {
    Hindsight.initSingletonTracking({})
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
      const config = { lineLimits: { maxBytes: 500 * 1000 * 1000 } } // 500 MB overall limit
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
            runUserRequests(requestCount, sessionDuration, config) // Start user requests without awaiting
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
      console.log(`Active users: ${activeSessions} @ ${(Date.now() - startTime) / 1000}s elapsed`, stats)
    }, 995)

    // Wait until the test duration has passed
    await new Promise(resolve => setTimeout(resolve, TEST_DURATION))
    // Cleanup
    clearInterval(intervalId)
    logMemoryUsage()
    await new Promise(resolve => setTimeout(resolve, 5000))
  })
})

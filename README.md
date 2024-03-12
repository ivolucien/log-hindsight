# log-hindsight
log-hindsight adds retroactive and conditional logic to standard loggers, allowing you to retroactively trigger what would have been logged at more detailed log level, such as after an error, to perform custom data filtering, or most custom logic you might need.

**NOT Production Ready** At this pre-alpha stage log-hindsight supports basic functions for a few popular logger modules, but has memory use and functional issues that need to be addressed before it can be used in production. It is not yet published to npm.

## Pre-Alpha Features
- **Retroactive Log History Dump**: Trigger previously buffered log entries for a given hindsight object to be written out when the calling application detects specific conditions, such as an error occurring.
- **Session-specific Logging**: Easily create and manage log contexts for individual user sessions or operational tasks, works with wrapped logger's child method if available.
- **Configurable Log Retention**: Customize how long historical logs are retained in the buffer before being discarded, based on maximum line count, memory consumptions or time since the line was buffered.
- **Integration with Standard Logging Libraries**: Wraps around popular logging modules, currently supports bunyan, pino, winston and console.

## Installation
Installation instructions will be provided once the module is published to npm.

## Basic Usage
_This is for the current state of development. It will be updated as the module matures._

```javascript
import Hindsight from 'log-hindsight'

// Initialize Hindsight
// default configuration is based on NODE_ENV environment variable
const logBuffer = new Hindsight() // production level: 'error', test: 'debug', test-trace: 'trace'

// Log messages
logBuffer.trace('Starting work...') // Buffered for possible future write
...

// ...later in your application
if (errorCondition) {
  logBuffer.writeIf('trace') // Write detailed log lines as context for the error
  logBuffer.error(new Error(errorCondition)) // Written immediately by default log level
}
```

## Why Use Hindsight? (once production ready)
_log-hindsight allows you to log much less normally but log more details when it's valuable._
- When an error occurs write historical log details to support investigation.
- Keep log retention costs low, but dynamically log details for a specific user.
- Log detailed information for a newly released endpoint.
- Just write error log lines normally, but for every 100th user request, write at trace level.

See [USE_CASES.md](USE_CASES.md) for more use case brainstorming and implementation ideas.

## Configuration Options

| Option            | Description                           | Default                            |
|-------------------|---------------------------------------|------------------------------------|
| `logger`          | Logger module used to write output    | `console` |
| `instanceLimits`  | Max count and age of logger objects   | `{ maxSize: 5000, maxAge: 70000 }` |
| `lineLimits`      | Line buffer limits; count, age, bytes | `{ maxSize: 1,000,0000, maxAge: 70,000, maxBytes: 100,000,000 } }` |
| `writeWhen`       | Level or function for when to write   | `{ level: 'info', writeLineNow: (metadata, lineArgs) => { /* return true to write now */ } }` |
| `moduleLogLevel`  | log-hindsight diagnostic log level    | `'error'` |

Configuration defaults are merged in this order:
 - constructor parameter is top priority, if any
 - else the NODE_ENV variable if there's a match in config.js
 - otherwise the default values in config.js - which are also the production env defaults

See also: src/config.js for the full list of configuration options and their defaults per environment.

## Manual Child Logger Creation

To create a child logger dedicated to a specific API session or task without logger persistence in between calls:

```javascript
const childLogger = logger.child({ perLineFields: { sessionId: 'unique-session-id' } })

childLogger.info('Session-specific log message')
```

## Singleton Tracked Logger using getOrCreateChild
If you wish to reuse a single logger instance across separate calls of a task or API session, use the static `getOrCreateChild` method to retrieve a child logger for a known unique ID -- it will create one if it doesn't exist yet (within the same node process).

```javascript
// child logger created for the first log call for this session
const childLogger = Hindsight.getOrCreateChild({ sessionId: 'unique-session-1' })

<later...>
// a separate call processing that same session, gets the same child logger (if within the same process)
const childLogger = Hindsight.getOrCreateChild({ sessionId: 'unique-session-1' })
```

## Contributors

This project is in the early stages of development and the author welcomes your input. If you're interested in contributing to log-hindsight, please contact me to coordinate on features. At this stage, it's too early in development for submitting PRs without coordination as the **interface isn't stable** yet.

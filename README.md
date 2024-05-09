# log-hindsight
log-hindsight adds retroactive and conditional logic to standard loggers, allowing you to retroactively trigger what would have been logged at more detailed log level, such as after an error, to perform custom data filtering, or most custom logging logic you might need.

**NOT Production Ready** At this pre-alpha stage log-hindsight supports basic functions for a few popular logger modules, but has memory use and functional issues that need to be addressed before it can be used in production. It is not yet published to npm.

See also: [API Documentation](API.md)

## Table of Contents
- [Pre-Alpha Features](#pre-alpha-features)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Why Use Hindsight? (once production ready)](#why-use-hindsight-once-production-ready)
- [Configuration Options](#configuration-options)
- [Manual Child Logger Creation](#manual-child-logger-creation)
- [Singleton Tracked Loggers](#singleton-tracked-loggers)
- [Monitoring log-hindsight](#monitoring-log-hindsight)
- [Contributors](#contributors)

<br>

## Pre-Alpha Features
- **Retroactive Log History Dump**: Trigger previously buffered log entries, to be written out under specific conditions such as an error occurring.
- **Session-specific Logging**: Track log contexts for individual user sessions or operational tasks.
- **Custom Data Filtering**: Apply custom data filtering or transformation to log lines before they are written, such as redacting sensitive data or retroactively adding fields.
- **Conditional Write Logic**: Use a custom function for when to write log lines immediately, such as when an error occurs, or when to buffer them for possible future writing.
- **Configurable Log Retention**: Customize how long buffered logs are retained before being discarded, by line count, memory consumption and/or line age.
- **Integration with Standard Logging Libraries**: Adapts to wrapped logger, explicitly supports bunyan, pino, winston and console.

## Installation
Installation instructions will be provided once the module is published to npm.

## Basic Usage
_This is for the current state of development. It will be updated as the module matures._

```javascript
import Hindsight from 'log-hindsight'

// Initialize Hindsight - many options are supported, see below and config.js
// default configuration is keyed off of NODE_ENV environment variable
const logBuffer = new Hindsight()

// Log messages
logBuffer.trace('Starting work...') // Buffered for possible future write
...

// ...later in your application
if (errorCondition) {
  // Manually trigger a log dump after an error,
  // Automated by setting the writeWhen.writeLineNow option to an onError function, example in conditions.js

  logBuffer.writeIf('trace') // Write detailed log lines as context for the error
  logBuffer.error(new Error(errorCondition)) // Written immediately by default log level
}
```

## Why Use Hindsight? (once production ready)
_log-hindsight allows you to log less detail normally but log more when it's valuable._

Highly customizable, see conditions.js for examples of custom logic.

- Write previously unwritten logs when an error occurs.
- Keep log retention costs low, but dynamically log details for a specific users or scenarios.
- Log detailed information for a newly released endpoint.
- Just write error log lines normally, but for every 100th user request, write at trace level.

## Configuration Options

| Option            | Description                           | Default                            |
|-------------------|---------------------------------------|------------------------------------|
| `logger`          | Logger module used to write output    | <pre>`console`</pre> |
| `instanceLimits`  | Max count and age of singleton loggers | <pre>`{ maxSize: 5000, maxAge: 70000 }`</pre> |
| `lineLimits`      | Line buffer limits; count, age, bytes | <pre>`{`<br>`  maxCount: 1,000,0000,`<br>`  maxAge: 70,000,`<br>`  maxBytes: 100,000,000`<br>`}`</pre> |
| `filterData`      | Function to clean or transform data   | <pre>`(arrayOfArgs) => {`<br>`  /* defaults to shallow copy when buffering */`<br>`}` |
| `writeWhen`       | Options for how to handle log lines   | <pre>`{`<br>  `level: 'error',`<br>  `writeLineNow: <see below>`<br>`}`</pre> |
| `writeWhen.level` | Level cutoff to consider writing now  | <pre>`'error'`</pre> |
| `writeWhen.writeLineNow` | Determines what to do with log lines | <pre>`(metadata, lineArgs) => true`</pre> |

Configuration defaults are merged in this order:
 - constructor parameter is top priority, if provided
 - else the NODE_ENV variable if there's a match in config.js
 - otherwise the default values in config.js - which are also the production env defaults

See also: [src/config.js](src/config.js) for the full list of configuration options and their defaults per environment.

## Manual Child Logger Creation

To create a child logger dedicated to a specific API session or task without logger persistence in between calls:

```javascript
const childLogger = logger.child({ perLineFields: { sessionId: 'unique-session-id' } })

childLogger.info('Session-specific log message')
```

## Singleton Tracked Loggers
If you wish to reuse a single logger instance across separate calls of a task or API session, use the static `getOrCreateChild` method to retrieve a child logger for a known unique ID -- it will create one if it doesn't exist yet (within the same node process).

For distributed systems it's valuable to implement session affinity to amplify this modules' benefits.

```javascript
// child logger created for the first log call for this session
const childLogger = Hindsight.getOrCreateChild({ perLineFields: { sessionId: 'unique-id-1' } })

<later...>
// a separate call processing that same session, gets the same child logger (if within the same process)
const childLogger = Hindsight.getOrCreateChild({ perLineFields: { sessionId: 'unique-id-1' } })
```

## Monitoring log-hindsight

log-hindsight uses the debug logger internally with 'hindsight:<component>:<level>' scoping.

```
DEBUG='hindsight:*,-*:trace # turn on info and error levels, only trace, info and error are used
DEBUG='hindsight:tests:*' # turn on all test logging
```

## Contributors

This project is in the early stages of development and the author welcomes your input. If you're interested in contributing to log-hindsight, please contact me to coordinate on features. At this stage, it's too early in development for submitting PRs without coordination as the **interface isn't stable** yet.

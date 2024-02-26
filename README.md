# log-hindsight
log-hindsight adds retroactive and conditional logic to standard loggers, allowing you to retroactively trigger what would have been logged at more detailed log level, such as after an error, or to perform custom data filtering, log sampling or to turn on detailed logging for specific users or endpoints.

By the first release log-hindsight will support multiple logging modules, but at this early stage of development it only supports the console logger.

## Features
_Most of this is already working but none of it has been vetted for production use, yet._
- **Retroactive Log History Dump**: Automatically output previously buffered log entries when specific conditions are met, such as an error occurring.
- **Session-specific Logging**: Easily create and manage log contexts for individual user sessions or operational tasks.
- **Configurable Log Retention**: Customize how long historical logs are retained in the buffer before being discarded, based on count or age.

## Planned Features
- **Integration with Standard Logging Libraries**: Designed to wrap around popular logging modules, currently only supports the console logger.
- **Conditional Log Sampling**: Define complex conditions under which logs should be captured or ignored, optimizing log volume and relevance.
- **Dynamic Log Level Adjustment**: Change log level on the fly based on runtime conditions or external triggers.

## Installation
Note: log-hindsight is currently in development and not yet ready for public release. Installation instructions will be provided once the module is published to npm.

## Quickstart
_This is a quickstart guide for the current state of development. It will be updated as the module matures._

```javascript
import Hindsight from 'log-hindsight';

// Initialize Hindsight
// default configuration is based on NODE_ENV environment variable
const logger = new Hindsight(); // production level: 'error', test: 'debug', test-trace: 'trace'

// Log messages
logger.trace('Starting work...'); // Buffered for possible future write

// ...later in your application
if (errorCondition) {
  logger.writeLines('debug'); // Write lines >= debug log level as context for the error
  logger.error(new Error('Yikes!')); // Written immediately by default log level
}
```

## Example Use Cases
_log-hindsight allows you to log much less normally but log more details when it's valuable._
- When an error occurs write historical log details to support investigation.
- Keep log retention costs low, but log details for a specific user.
- Log detailed information for a newly released endpoint.
- Just write error log lines normally, but for every 100th user request, write at trace level.

See [USE_CASES.md](USE_CASES.md) for more interesting use cases and implementation ideas.

## Configuration Options

| Option            | Description                           | Default             |
|-------------------|---------------------------------------|---------------------|
| `instanceLimits`  | Max count and age for log instances   | `{ maxSize: 5000, maxAge: 70000 }` |
| `logger`          | Logger module used to write output    | `console`           |
| `moduleLogLevel`  | Internal log-hindsight log level      | `'error'`           |
| `rules`           | Rules for writing and buffer limits | `{ write: { level: 'info' }, lineLimits: { maxSize: 1,000,0000, maxAge: 70,000, maxBytes: 1GB } }` |

## Manual Child Logger Creation

To create a child logger dedicated to a specific API session or task, when you can pass the logger along:

```javascript
const childLogger = logger.child({ perLineFields: { sessionId: 'unique-session-id' } });

childLogger.info('Session-specific log message');
```

## Automated Singleton Child Logger Get or Create
If you wish to reuse a single logger instance across separate calls of a task or API session, use the static `getOrCreateChild` method to retrieve a child logger for a known unique ID -- it will create one if it doesn't exist yet.

```javascript
// child logger created for the first log call for this session
const childLogger = Hindsight.getOrCreateChild({ sessionId: 'unique-session-1' });

<later...>
// a separate call processing that same session, gets the same child logger (if within the same process)
const childLogger = Hindsight.getOrCreateChild({ sessionId: 'unique-session-1' });
```

## Change Log

### v0.1.0 Unstable development version with roughed out functionality - 2024-02-04
- Wrapper support for console logger
- Support logger singletons for the local process, unique per a set of static values, like a session ID
- Manage logger singleton quantity and lifespan, using an LRU cache with a max instance count and age
- Buffer log lines that fall below the current log level, limited by max count and age
- Write historical lines from a logger based on a dynamically specified log level

### v0.2.0 Unstable development version with basic support for common loggers - 2024-02-25
- Support for the common denominator of common logger modules
- Limit buffered log data based on overall memory use and/or custom criteria

## Roadmap

### Planned for v0.3.0
- Support for on-the-fly write rule changes (like current log level)
- Caller supplied function to decorate each line with metadata properties
- Caller supplied function to choose the write log level based on app requirements

### Future Feature Wishlist
- Option for centralized storage of buffered log data using your preferred storage system

## Intended Use Cases (no later than v1.0.0)

 * Retroactively output trace and/or debug log data when a task/request throws an error
 * Log a chosen % of tasks/requests at trace level
 * Options to automatically strip specified data from logged objects
 * Throttle log level when log data volume over a chosen threshold

## Contributors

This project is in the early stages of development and the author welcomes your input. If you're interested in contributing to log-hindsight, please contact me to coordinate on features. At this stage, it's too early in development for submitting PRs without coordination as the interface isn't stable yet.

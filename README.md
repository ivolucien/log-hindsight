# log-hindsight
_logging features you didn't know you wanted_

log-hindsight adds retroactive and conditional logic to standard logging, allowing for history dumps when desired, like after an error, and custom conditional log sampling.

By the first release log-hindsight will support multiple logging modules, but at this early stage of development it only supports the console logger.

## Installation
_Module is not ready for alpha release yet. It's in early development and not yet published to npm._

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
  logger.writeLines('debug'); // Write previously buffered lines as context for the error
  logger.error(new Error('Yikes!')); // Written immediately by default log level
}
```

## Configuration Options

| Option            | Description                           | Default             |
|-------------------|---------------------------------------|---------------------|
| `instanceLimits`  | Max count and age for log instances   | `{ maxSize: 5000, maxAge: 70000 }` |
| `logger`          | Logger module used to write output    | `console`           |
| `moduleLogLevel`  | Internal log-hindsight log level      | `'error'`           |
| `rules`           | Rules for writing and buffer trimming | `{ write: { level: 'error' }, trim: { lineCountAbove: 10000, lineOlderThanMs: 70000 } }` |

## Manual Child Logger Creation

To create a child logger dedicated to a specific API session or task:

```javascript
const childLogger = logger.child({ perLineFields: { sessionId: 'unique-session-id' } });

// Then just use childLogger for a specific session if you can pass it around as needed
childLogger.info('Session-specific log message');
```

## Automated Singleton Child Logger Get or Create
If you wish to reuse a single logger instance for across separate calls of a task or API session, use the static `getOrCreateChild` method to retrieve a child logger for a known unique ID -- it will create one if it doesn't exist yet.

```javascript
// child logger created for the first log call for this session
const childLogger = Hindsight.getOrCreateChild({ sessionId: 'unique-session-1' });

// a separate API call of the that same session, gets the same child logger (if within the same process)
const childLogger = Hindsight.getOrCreateChild({ sessionId: 'unique-session-1' });
```

## Roadmap

### Planned for v0.1.0
- Wrapper support for console logger
- Support logger singletons for the local process, by category or unique ID
- Manage logger singleton quantity and lifespan
- Buffer log lines that fall below the current log level, limited by max count and age
- Write historical lines from a logger based on a dynamically specified log level

### Planned for v0.2.0
- Support for the common denominator of common logger modules
- Limit buffered log data based on overall memory use and/or custom criteria
- Dynamic/custom filtering and transforms
- Deferred log level assignment

### Future Feature Wishlist
- Option for centralized storage of buffered log data using your preferred storage system
hold

## Intended Use Cases (no later than v1.0.0)

 * Retroactively output trace and/or debug log data when a task/request throws an error
 * Log a chosen % of tasks/requests at trace level
 * Options to automatically strip specified data from logged objects
 * Throttle log level when log data volume over a chosen thres

## Contributors

We are in the early stages of development and welcome collaboration. If you're interested in contributing to log-hindsight, please contact me to coordinate on features. At this stage, it's too early in development for submitting PRs without coordination.



# log-hindsight API Reference

## Hindsight

`Hindsight` is a logger wrapper that supports conditional logging logic, maintaining log line buffers for each log level and supporting dynamic rule-based logging.

#### new Hindsight (config, perLineFields)

_Constructor. All parameters are optional, per NODE_ENV defaults are listed in the [defaults file](config.js)._

  - `config` (Object): Configuration options for the instance, structured as follows:
    - `instanceLimits` (Object): Specifies the maximum number of Hindsight instances.<br>
      &nbsp; &nbsp; &nbsp; &nbsp; `{ maxSize: 5000, maxAge: 70000 }`
    - `lineLimits` (Object): Defines the buffering limits for log lines, such as maximum age, count, and size in bytes.<br>
      &nbsp; &nbsp; &nbsp; &nbsp; `{ maxCount: 100, maxAge: 10000, maxBytes: 500000 }`
    - `logger` (Object|Function): The logging interface or factory function used for output, defaults to `console`.
    - `filterData` (Function): A function to modify or filter log data before it is buffered (optional)
    - `writeWhen` (Object): Rules for when log lines should be output immediately, see `writeIf()` below (optional)<br>
      &nbsp; &nbsp; &nbsp; &nbsp; `{ level: 'error', writeLineNow: (metadata, lineArgs) => /* your code, return a boolean */ }`
  - `perLineFields` (Object): Metadata to attach to every log line, used to uniquely identify log contexts (optional)

#### getOrCreateChild (perLineFields)
_Retrieves or creates a child Hindsight instance based on unique per-line field data._

  - `perLineFields` (Object): Fields to uniquely identify the logger instance.

    **Returns:** `Hindsight` instance, may be newly created or retrieved from the LRU cache.

#### child (configOverrides)
_Creates a new Hindsight instance using the current instance as a base, with config overrides if desired._

  - `configOverrides` (Object): Configuration overrides for the child instance.

    **Returns:** `Hindsight` instance, does **not** retrieve the existing child instance, if any.

**writeIf (levelCutoff, writeLineNow)**: Writes buffered log lines meeting the specified conditions, for all log levels at or above the specified level cutoff.

  - `levelCutoff` (String): Minimum log level required for a line to be considered for writing.
  - `writeLineNow` (Function): A callback that takes `metadata` and `lineArgs`, and returns `true` if the line should be written immediately.

  _Filtering and writing historical lines is fire-and-forget, processed hindsight.batchSize at a time._

    **Returns:** None. This operation is **performed asynchronously** and does not return a value.<br>
    ```javascript
    hindsight.writeIf('debug', ({ metadata, lineArgs }) => {
      return metadata.perLineFields.vip || linArgs.includes('New Feature');
    });
    ```

### LogAdapter

General interface for a wrapped logger instance, for writing log lines and setting log levels. Supports passthrough to the underlying logger via `hindsight.adapter.logger`.

### LevelBuffers

Handles buffering of log lines across different levels with constraints on age, size, and total byte size.

`LevelBuffers (options)`

  - `options` (Object): Configuration options for line buffering.
    - `maxAge` (Number): Maximum age in milliseconds before a log line is discarded.
    - `maxLineCount` (Number): Maximum number of log lines that can be buffered.
    - `maxBytes` (Boolean|Number): Maximum bytes that can be buffered.

### LineBuffer

Utility class for storing log lines in a buffer.

## Usage Example

```javascript
import Hindsight from 'hindsight';

const config = {
  lineLimits: { maxAge: 10000, maxCount: 100, maxBytes: 500000 },
  logger: console,
  writeWhen: { level: 'error' }
};
const perLineFields = { userId: 12345 };

const hindsight = new Hindsight(config, perLineFields);
const sessionLogger = hindsight.getOrCreateChild({ sessionId: 'abc123' });
sessionLogger.writeIf('info', (metadata, lineArgs) => /* code that returns true or false (write or ignore) */);

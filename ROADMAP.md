## Roadmap

## Planned Functionality - prior to NPM release
- **Conditional Log Sampling**: Define custom conditions under which logs should be captured or ignored, optimizing log retention volume and relevance.
- **Dynamic Log Level Adjustment**: Change log level on the fly based on runtime conditions or external triggers.
  - user callback parameters include line context, memory use and simple logging rate statistics.
- **Custom Log Line Filtering**: Define custom functions to filter log lines, such as redacting sensitive data or adding metadata.
- **Reduce Memory Consumption**: Optimize memory use by keeping a simplified copy of log args for output, to support high volume logging in production environments. (avoid long-lived closures, summarize objects and collections, etc.)
- **Add Async Processing**: Process log line loops and user defined functions asynchronously to avoid blocking the event loop.

### Planned for v0.3.0
- Support for on-the-fly write rule changes (like current log level)
- Asynchronous bulk processing and writes of historical log lines to prevent event loop lag
- More complete testing of session-based logging and per line field handling
- Caller supplied function to conditionally alter log lines, such as to redact sensitive data or add metadata
- Caller supplied function to dynamically specify what lines to write or buffer
  - allows automatic throttling based on whatever the caller accesses in the function, e.g. log volume
  - log sampling, such as every 100th request use trace level
  - choose log level by session, endpoint version, A/B test, etc.

### Possible features for v0.4.0 or later
- Option for centralized storage of buffered log data using your preferred storage system
  - allows for log data to be retained across process restarts, and handled per session or task
- Caller supplied function to route log lines to different log retention targets
  - supports sending lower priority log lines to a cheaper storage system
  - supports different retention target when errors occur


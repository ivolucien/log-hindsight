## Roadmap

### Planned for v0.3.0
- Support for on-the-fly write rule changes (like current log level)
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

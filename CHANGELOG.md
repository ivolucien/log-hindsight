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


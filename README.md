# log-hindsight
_logging features you didn't know you wanted_

## DRAFT - Project started Dec 2022

### Wrap retroactive and conditional logic around any supported logging module

I'm writing this to reduce log storage bloat for high volume projects, with sampling and filtering to dynamically limit output.

Expect progress on this module to be intermittent, cuz kids

_Please use labels for bugs, questions and feature suggestions_

 ## Planned core features for v0.1 - still flexible on these

 * Queue some or all log data to an in-memory queue
   * drop queued log data based on identifier, age, overall queue size and/or custom criteria
   * store original log event timestamp and log level
   * associate log data with a task or request identifier
 * Dynamic / custom filtering and transforms
 * Deferred log level assignment based on configured or custom logic

### Example Uses

 * Retroactively output trace and debug log data when a task/request throws an error
 * Log 1% of tasks/requests at trace level
 * Strip specified data from logged objects
 * Throttle log level when log data volume over a chosen threshold

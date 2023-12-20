# log-hindsight
_logging features you didn't know you wanted_

## DRAFT - v0.1 to support console logger only

### Wrap retroactive and conditional logic around any supported logging module

I'm writing this to improve the usefulness of logging output for high volume projects, with conditional retroactive output, plus sampling and filtering to dynamically limit output.

Expect progress on this module to be very slow. I'd be happy to colaborate with someone with more free time.

_Please use labels for bugs, questions and feature suggestions_

 ## Planned core features for v0.1 - still flexible on these

 * Queue some or all log data to an in-memory queue
   * drop queued log data based on identifier or age
   * store original log event timestamp and log level
   * associate log data with a task or request identifier

 ## Tentatively planned for v0.2
   * support one additional logger module out of the box, likely bunyon or winston
   * drop queued log data based on overall queue size and/or custom criteria
   * Dynamic / custom filtering and transforms
   * Deferred log level assignment based on configured or custom logic

### Example uses once implemented

 * Retroactively output trace and debug log data when a task/request throws an error
 * Log 1% of tasks/requests at trace level
 * Options to automatically strip specified data from logged objects
 * Throttle log level when log data volume over a chosen threshold

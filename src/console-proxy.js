const QUEUE_NAMES = [
  'dir',
  'log',
  'trace',
  'debug',
  'info',
  'warn',
  'error'
];

export default {
  getQueueNames() { return QUEUE_NAMES; },
  isConsole(obj) { return obj instanceof console.Console; },
}

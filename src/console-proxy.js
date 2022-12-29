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
  useModuleDirectly: true,
  getQueueNames() { return QUEUE_NAMES; },
}
// todo: add any other relevant console method names
const LOG_METHODS = [
  'dir',
  'log',
  'trace',
  'debug',
  'info',
  'warn',
  'error'
];

export default {
  getLogTableNames() { return LOG_METHODS; },
  isConsole(obj) { return obj instanceof console.Console; }, // todo: support browsers w/ no .Console?
}

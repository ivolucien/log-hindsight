// todo: add any other relevant console method names
const LOG_METHODS = [
  { name: 'trace', level: 10 },
  { name: 'debug', level: 20 },
  { name: 'dir', level: 20 },
  { name: 'info', level: 30 },
  { name: 'log', level: 30 },
  { name: 'warn', level: 40 },
  { name: 'error', level: 50 },
];
const LOG_NAMES =  LOG_METHODS.reduce(
  (names, method) => { names.push(method.name); return names; },
  []
);

export default {
  getLogMethods() { return [ ...LOG_METHODS ] },

  getLogTableNames() {
    return LOG_NAMES;
  },

  isConsole(obj) {
    return obj instanceof console.Console; // todo: support browsers w/ no .Console?
  },
}

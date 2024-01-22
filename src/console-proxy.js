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
const LOG_LEVELS =  LOG_METHODS.reduce(
  (levels, {name, level}) => {
    levels[name] = level;
    levels[level] = level;
    return levels; },
  {}
);

export default {
  getLogMethods() { return [ ...LOG_METHODS ] },

  get logTableNames() {
    return LOG_NAMES;
  },

  get levelIntHash() {
    return LOG_LEVELS;
  },

  isConsole(obj) {
    return obj != null && obj instanceof console.Console; // todo: support browsers w/ no .Console?
  },
}

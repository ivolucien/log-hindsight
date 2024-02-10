import chai from 'chai';
import spies from 'chai-spies';
import LogAdapter from '../adapter.js';

chai.use(spies);
const expect = chai.expect;

describe('LogAdapter', () => {
  const validModule = console;
  const invalidModule = { log: () => {} };

  describe('constructor', () => {
    it('should create an instance of LogAdapter with the provided module', () => {
       const logAdapter = new LogAdapter(validModule);
      expect(logAdapter).to.be.an.instanceOf(LogAdapter);
      expect(logAdapter.module).to.equal(validModule);
    });
  });

  describe('static initLogMethods', () => {
    it('should initialize all common log methods on the LogAdapter class prototype', () => {
      LogAdapter.initLogMethods(validModule);
      const logAdapter = new LogAdapter(validModule);

      const logMethods = logAdapter.getLogMethods();

      logMethods.forEach(({ name, level }) => {
        expect(logAdapter[name]).to.be.a('function');
      });
    });

    it('should initialize the name array and lookup hash for all log levels', () => {
      LogAdapter.initLogMethods(validModule);
      const logAdapter = new LogAdapter(validModule);

      const logMethods = logAdapter.getLogMethods();

      logMethods.forEach(({ name, level }) => {
        expect(logAdapter.levelNames).to.include(name);
        expect(logAdapter.levelLookup[name]).to.equal(level);
        expect(logAdapter.levelLookup[level]).to.equal(level);
      });
    });

    it('should call the corresponding methods on the provided module', () => {
      const module = { ...console, silly: () => {}, info: () => {} };
      const sillySpy = chai.spy.on(module, 'silly');
      const infoSpy = chai.spy.on(module, 'info');

      LogAdapter.initLogMethods(module, true);
      const logAdapter = new LogAdapter(module);

      logAdapter.silly('Silly log');
      expect(sillySpy).to.have.been.called.with('Silly log');

      logAdapter.info('Info log');
      expect(infoSpy).to.have.been.called.with('Info log');
    });
  });

  // Add more test cases for other methods in LogAdapter class
});

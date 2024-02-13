import chai from 'chai';
import bunyan from 'bunyan';
import winston from 'winston';
import pino from 'pino';
import stream from 'stream';

import LogAdapter from '../adapter.js'; // Adjust the path as necessary
import { LOG_LEVELS } from '../adapter.js';

const expect = chai.expect;


// Create a writable stream to capture log messages
const createCaptureStream = () => {
  const output = [];
  const writable = new stream.Writable({
    write(chunk, encoding, callback) {
      output.push(chunk.toString());
      callback();
    }
  });
  writable.output = output;
  return writable;
};

describe('LogAdapter Integration Tests', () => {
  // Define loggers with redirected output
  const captureStream = createCaptureStream();
  const loggers = {
//    bunyan: bunyan.createLogger({ name: 'test', stream: captureStream, level: 'trace' }),
    winston: winston.createLogger({
      transports: [new winston.transports.Stream({ stream: captureStream })],
      level: 'silly'
    }),
//    pino: pino({ level: 'trace' }, captureStream)
  };

  Object.entries(loggers).forEach(([loggerName, logger]) => {
    describe(`${loggerName} logger`, () => {
      let adapter = new LogAdapter(logger);

      beforeEach(() => {
        captureStream.output.length = 0; // Clear captured output before each test
      });

      Object.keys(LOG_LEVELS).forEach(level => {
        it(`should log a message for ${level}`, () => {
          adapter[level]('Test message');

          // Verify that a message was captured
          expect(captureStream.output.length).to.be.greaterThan(0);
          // Further inspection of the output can be done here if necessary
        });
      });
    });
  });
});

// temporary intercept of stdout and stderr writes
function captureStdStreams(stream) {
    const originalWrite = stream.write;
    let output = [];

    stream.write = (chunk, encoding, callback) => {
        output.push(chunk.toString());
        originalWrite.call(stream, chunk, encoding, callback);
    };

    return {
        output,
        restore: () => stream.write = originalWrite
    };
}

function hasSubString(array, subString) {
    return array.some((string) => string.includes(subString));
}

describe('LogAdapter integration test with console logger', () => {
    let stdoutCapture, stderrCapture;

    beforeEach(() => {
        // Start capturing stdout and stderr
        stdoutCapture = captureStdStreams(process.stdout);
        stderrCapture = captureStdStreams(process.stderr);
    });

    afterEach(() => {
      // Stop capturing and clean up
      stdoutCapture?.restore();
      stderrCapture?.restore();
    });

    it('should correctly delegate to expected log methods', () => {
        const adapter = new LogAdapter(console);

        // Test a variety of console methods
        adapter.dir('Called console.dir');
        adapter.debug('Called console.debug');
        adapter.log('Called console.log');
        adapter.info('Called console.info');
        adapter.warn('Called console.warn');
        adapter.error('Called console.error');

        stdoutCapture.restore();
        stderrCapture.restore();

        // dir, debug, log and info should be written to stdout
        expect(hasSubString(stdoutCapture.output, 'Called console.dir')).to.be.true;
        expect(hasSubString(stdoutCapture.output, 'Called console.debug')).to.be.true;
        expect(hasSubString(stdoutCapture.output, 'Called console.log')).to.be.true;
        expect(hasSubString(stdoutCapture.output, 'Called console.info')).to.be.true;

        // warn and error should be written to stderr
        expect(hasSubString(stderrCapture.output, 'Called console.warn')).to.be.true;
        expect(hasSubString(stderrCapture.output, 'Called console.error')).to.be.true;
    });

    it('should correctly delegate to expected fallback methods', () => {
      const adapter = new LogAdapter(console);

      // Test a variety of console methods
      adapter.silly('Called console.silly');
      adapter.verbose('Called console.verbose');
      adapter.fatal('Called console.fatal');

      stdoutCapture.restore();
      stderrCapture.restore();

      // messages were written as expected
      expect(hasSubString(stdoutCapture.output, 'Called console.silly')).to.be.true;
      expect(hasSubString(stdoutCapture.output, 'Called console.verbose')).to.be.true;

      expect(hasSubString(stderrCapture.output, 'Called console.fatal')).to.be.true;
  });

  // Additional tests for other console methods and scenarios can be added here
});

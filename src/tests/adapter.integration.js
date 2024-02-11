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
          console.dir(adapter);
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

describe('LogAdapter integration test with console logger', () => {
    let stdoutCapture, stderrCapture;

    beforeEach(() => {
        // Start capturing stdout and stderr
        stdoutCapture = captureStdStreams(process.stdout);
        stderrCapture = captureStdStreams(process.stderr);
    });

    afterEach(() => {
        // Stop capturing and clean up
        stdoutCapture.restore();
        stderrCapture.restore();
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

        // Verify that messages were captured
        expect(stdoutCapture.output).to.include('Called console.dir');
        expect(stdoutCapture.output).to.include('Called console.debug');
        expect(stdoutCapture.output).to.include('Called console.log');
        expect(stdoutCapture.output).to.include('Called console.info');
        expect(stderrCapture.output).to.include('Called console.error');
        expect(stdoutCapture.output).to.include('Called console.warn');
    });

    it('should correctly delegate to expected fallback methods', () => {
      const adapter = new LogAdapter(console);

      // Test a variety of console methods
      adapter.silly('Called console.silly');
      adapter.verbose('Called console.verbose');
      adapter.fatal('Called console.fatal');

      // Verify that messages were captured
      expect(stdoutCapture.output).to.include('Called console.silly');
      expect(stdoutCapture.output).to.include('Called console.verbose');
      expect(stdoutCapture.output).to.include('Called console.fatal');
  });

  // Additional tests for other console methods and scenarios can be added here
});

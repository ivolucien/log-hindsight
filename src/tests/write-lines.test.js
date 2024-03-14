import chai, { expect } from 'chai'
import chaiSpies from 'chai-spies'
import Hindsight from '../index.js'

chai.use(chaiSpies)

describe('hindsight.writeIf() Tests', function () {
  let hindsight

  beforeEach(() => {
    hindsight = new Hindsight({
      logger: console,
      writeWhen: { level: 'info' } // the default, but explicitly set here
    })
  })

  it('should call the user defined function (UDF) for each buffered line', () => {
    const spy = chai.spy(() => true)
    hindsight.debug('Debug message should be buffered')
    hindsight.writeIf('debug', spy)
    expect(spy).to.have.been.called.once
  })

  it('should not call UDF for lines below the specified level', () => {
    const spy = chai.spy(() => true)
    hindsight.trace('Trace message should not trigger UDF')
    hindsight.writeIf('debug', spy)
    expect(spy).not.to.have.been.called()
  })

  it('should correctly pass line metadata and args to UDF', () => {
    const spy = chai.spy(() => true)
    hindsight.debug('Info message for UDF')
    hindsight.writeIf('debug', spy)

    expect(spy).to.have.been.called.once
    expect(spy.__spy.calls[0][0]).to.deep.include({
      lineArgs: ['Info message for UDF']
    })
    expect(spy.__spy.calls[0][0].metadata).to.include.keys(['level', 'timestamp', 'estimatedLineBytes'])
  })

  it('should write line when UDF returns true', () => {
    const spy = chai.spy(() => true)
    hindsight.debug('Message to write')
    hindsight.writeIf('debug', spy)

    expect(hindsight.debug.writeCounter).to.equal(1)
    expect(spy).to.have.been.called()
  })

  it('should keep line in buffer when UDF returns false', () => {
    const spy = chai.spy(() => false)
    hindsight.debug('Message not to write')
    hindsight.writeIf('debug', spy)

    expect(hindsight.debug.writeCounter).to.equal(0)
    expect(spy).to.have.been.called()
  })

  it('should handle multiple log levels correctly', () => {
    const spy = chai.spy(() => true)
    hindsight.debug('Debug message')
    hindsight.trace('Info message')
    hindsight.writeIf('trace', spy)

    expect(spy).to.have.been.called.exactly(2)
  })

  it('should filter out lines below the cutoff level', () => {
    const spy = chai.spy(() => true)
    hindsight.debug('Debug message')
    hindsight.trace('Info message')
    hindsight.writeIf('debug', spy)

    // only the debug message should trigger the spy, not the debug message
    expect(spy).to.have.been.called.once
  })

  it('should sort lines by timestamp before writing', () => {
    const spyWriteLine = chai.spy.on(hindsight, '_writeLine', () => {})
    const now = Date.now()

    hindsight.debug('Originally 1st')
    hindsight.trace('Originally 2nd')

    const then = Date.now() - 1000
    expect(hindsight.buffers.get('trace')).to.be.an('object')

    hindsight.buffers.get('trace').lines.get(0).context.timestamp = then
    hindsight.buffers.get('debug').lines.get(0).context.timestamp = now
    hindsight.writeIf('trace', () => true)

    const paramsInOrder = spyWriteLine.__spy.calls.map((call) => {
      return { name: call[0], time: call[1].timestamp, message: call[2][0] }
    })
    expect(paramsInOrder).to.eql([
      { name: 'trace', time: then, message: 'Originally 2nd' },
      { name: 'debug', time: now, message: 'Originally 1st' }
    ])
  })

  it('should maintain buffer when UDF returns false for all lines', () => {
    const spy = chai.spy(() => false)

    hindsight.trace('Message 1')
    hindsight.trace('Message 2')
    hindsight.writeIf('trace', spy)

    const buffer = hindsight.buffers.get('trace')
    expect(buffer.size).to.equal(2)
  })
})

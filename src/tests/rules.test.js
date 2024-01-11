import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight Rules Tests', function() {
  it('should set the default rule for a Hindsight instance correctly', function() {
    const hindsight = new Hindsight();
    expect(hindsight.rules).to.eql({ write: { level: 'info' } });
  });
});

import { expect } from 'chai';
import Hindsight from '../index.js';

describe('Hindsight Getter Tests', function() {
  describe('instanceId Getter', function() {
    it('should return the correct value', function() {
      const hindsight = new Hindsight({});
      const expectedId = 'id' + hindsight._instanceId;
      expect(hindsight.instanceId).to.equal(expectedId); // format is 'id' + instanceId

      try {
        hindsight.instanceId = 'test'; // should not be able to set instanceId
      } catch (e) {
        // Expect an error to be thrown
      }

      expect(hindsight.instanceId).to.equal(expectedId); // should not have changed
    });
  });

  describe('getTable Method', function() {
    it('should return the correct log table', function() {
      const hindsight = new Hindsight();
      const firstId = hindsight._instanceId;
      hindsight._debug(hindsight.logTables);
      hindsight.proxy.logTableNames.forEach((name) => {
        const sessionId = hindsight.instanceId;
        expect(hindsight._getTable(name, sessionId)).to.deep.eql({ counter: 1 });
      });

      const hindsight2 = new Hindsight();
      const secondId = hindsight2._instanceId;
      expect(hindsight2.instanceId).to.equal('id' + secondId);
      expect(secondId).to.equal(firstId + 1);
    });
  });

  // Additional tests for other getters can be added here
});

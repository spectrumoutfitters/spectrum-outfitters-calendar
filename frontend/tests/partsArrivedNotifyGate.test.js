import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  partsArrivedError,
  buildPartsArrivedPayload,
} from '../src/utils/partsArrivedNotifyGate.js';

describe('partsArrivedError', () => {
  it('requires a trimmed vehicle before distributor', () => {
    assert.equal(partsArrivedError('', 'AutoZone'), 'Please enter the vehicle/car information');
    assert.equal(partsArrivedError('   ', 'AutoZone'), 'Please enter the vehicle/car information');
    assert.equal(partsArrivedError(null, 'AutoZone'), 'Please enter the vehicle/car information');
  });

  it('requires a trimmed distributor after vehicle is present', () => {
    assert.equal(partsArrivedError('2020 Lexus RX350', ''), 'Please enter the parts distributor');
    assert.equal(partsArrivedError('2020 Lexus RX350', '   '), 'Please enter the parts distributor');
    assert.equal(partsArrivedError('2020 Lexus RX350', 'NAPA'), null);
  });
});

describe('buildPartsArrivedPayload', () => {
  it('aliases trimmed vehicle onto taskTitle for backward compatibility', () => {
    assert.deepEqual(buildPartsArrivedPayload('  2018 F150  ', '  O\'Reilly  '), {
      type: 'parts_arrived',
      taskTitle: '2018 F150',
      vehicle: '2018 F150',
      distributor: "O'Reilly",
    });
  });
});

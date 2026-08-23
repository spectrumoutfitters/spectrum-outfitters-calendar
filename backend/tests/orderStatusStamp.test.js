import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidOrderStatus,
  statusRouteTimestampFlags,
  updateRouteTimestampFlags,
} from '../utils/orderStatusStamp.js';

describe('isValidOrderStatus', () => {
  it('accepts the four stored statuses and rejects others', () => {
    assert.equal(isValidOrderStatus('pending'), true);
    assert.equal(isValidOrderStatus('paid'), true);
    assert.equal(isValidOrderStatus('fulfilled'), true);
    assert.equal(isValidOrderStatus('cancelled'), true);
    assert.equal(isValidOrderStatus('canceled'), false);
    assert.equal(isValidOrderStatus('PAID'), false);
    assert.equal(isValidOrderStatus(''), false);
    assert.equal(isValidOrderStatus(undefined), false);
    assert.equal(isValidOrderStatus(null), false);
  });
});

describe('statusRouteTimestampFlags (PUT /:id/status)', () => {
  it('always restamps paid_at / fulfilled_at when entering those statuses', () => {
    assert.deepEqual(statusRouteTimestampFlags('paid'), { paidAt: true, fulfilledAt: false });
    assert.deepEqual(statusRouteTimestampFlags('fulfilled'), { paidAt: false, fulfilledAt: true });
    assert.deepEqual(statusRouteTimestampFlags('pending'), { paidAt: false, fulfilledAt: false });
    assert.deepEqual(statusRouteTimestampFlags('cancelled'), { paidAt: false, fulfilledAt: false });
  });
});

describe('updateRouteTimestampFlags (PUT /:id)', () => {
  it('stamps only on transition, not when already paid/fulfilled', () => {
    assert.deepEqual(updateRouteTimestampFlags('paid', 'pending'), {
      paidAt: true,
      fulfilledAt: false,
    });
    assert.deepEqual(updateRouteTimestampFlags('paid', 'paid'), {
      paidAt: false,
      fulfilledAt: false,
    });
    assert.deepEqual(updateRouteTimestampFlags('fulfilled', 'paid'), {
      paidAt: false,
      fulfilledAt: true,
    });
    assert.deepEqual(updateRouteTimestampFlags('fulfilled', 'fulfilled'), {
      paidAt: false,
      fulfilledAt: false,
    });
    assert.deepEqual(updateRouteTimestampFlags('pending', 'paid'), {
      paidAt: false,
      fulfilledAt: false,
    });
  });
});

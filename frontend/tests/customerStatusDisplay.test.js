import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMER_STATUS_CONFIG,
  getCustomerStatusDisplay,
  getCustomerStatusStepIndex,
} from '../src/utils/customerStatusDisplay.js';

describe('getCustomerStatusDisplay', () => {
  it('maps internal statuses to customer-facing labels', () => {
    assert.equal(getCustomerStatusDisplay('todo').label, 'Received');
    assert.equal(getCustomerStatusDisplay('in_progress').label, 'In Progress');
    assert.equal(getCustomerStatusDisplay('review').label, 'Ready for Pickup');
    assert.equal(getCustomerStatusDisplay('completed').label, 'Completed');
  });

  it('falls back to Received for unknown / missing status', () => {
    assert.equal(getCustomerStatusDisplay('unknown'), CUSTOMER_STATUS_CONFIG.todo);
    assert.equal(getCustomerStatusDisplay(undefined), CUSTOMER_STATUS_CONFIG.todo);
    assert.equal(getCustomerStatusDisplay(null), CUSTOMER_STATUS_CONFIG.todo);
  });
});

describe('getCustomerStatusStepIndex', () => {
  it('returns the progress-bar index, or -1 when unknown (all steps gray)', () => {
    assert.equal(getCustomerStatusStepIndex('todo'), 0);
    assert.equal(getCustomerStatusStepIndex('in_progress'), 1);
    assert.equal(getCustomerStatusStepIndex('review'), 2);
    assert.equal(getCustomerStatusStepIndex('completed'), 3);
    assert.equal(getCustomerStatusStepIndex('bogus'), -1);
    assert.equal(getCustomerStatusStepIndex(undefined), -1);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMissingTaskId,
  normalizeOptionalCustomerField,
  buildCustomerStatusUrl,
  isMissingStatusLink,
  toPublicCustomerStatus,
} from '../utils/customerStatusMath.js';

describe('isMissingTaskId', () => {
  it('treats falsy ids as missing (current generate gate)', () => {
    assert.equal(isMissingTaskId(undefined), true);
    assert.equal(isMissingTaskId(null), true);
    assert.equal(isMissingTaskId(''), true);
    assert.equal(isMissingTaskId(0), true);
    assert.equal(isMissingTaskId(false), true);
  });

  it('accepts non-empty string and positive numeric ids', () => {
    assert.equal(isMissingTaskId('0'), false);
    assert.equal(isMissingTaskId(1), false);
    assert.equal(isMissingTaskId('12'), false);
    assert.equal(isMissingTaskId('abc'), false);
  });
});

describe('normalizeOptionalCustomerField', () => {
  it('coerces falsy values to null; keeps truthy text', () => {
    assert.equal(normalizeOptionalCustomerField(undefined), null);
    assert.equal(normalizeOptionalCustomerField(null), null);
    assert.equal(normalizeOptionalCustomerField(''), null);
    assert.equal(normalizeOptionalCustomerField(0), null);
    assert.equal(normalizeOptionalCustomerField(false), null);
    assert.equal(normalizeOptionalCustomerField('Jane'), 'Jane');
    assert.equal(normalizeOptionalCustomerField('0'), '0');
    assert.equal(normalizeOptionalCustomerField('  '), '  ');
  });
});

describe('buildCustomerStatusUrl', () => {
  it('prefixes the public /status/ path', () => {
    assert.equal(buildCustomerStatusUrl('deadbeef'), '/status/deadbeef');
    assert.equal(buildCustomerStatusUrl(''), '/status/');
  });
});

describe('isMissingStatusLink', () => {
  it('404s on falsy lookup rows', () => {
    assert.equal(isMissingStatusLink(undefined), true);
    assert.equal(isMissingStatusLink(null), true);
    assert.equal(isMissingStatusLink(0), true);
    assert.equal(isMissingStatusLink(''), true);
    assert.equal(isMissingStatusLink({ task_id: 1 }), false);
  });
});

describe('toPublicCustomerStatus', () => {
  it('exposes only the customer-facing fields (no task_id/phone/token)', () => {
    const publicPayload = toPublicCustomerStatus({
      customer_name: 'Pat',
      customer_phone: '555-0100',
      task_id: 99,
      token: 'secret-token',
      created_by: 7,
      task_title: 'Wheel install',
      status: 'in_progress',
      description: 'Waiting on parts',
      due_date: '2026-08-22',
      last_updated: '2026-08-21T12:00:00Z',
    });

    assert.deepEqual(publicPayload, {
      customer_name: 'Pat',
      task_title: 'Wheel install',
      status: 'in_progress',
      description: 'Waiting on parts',
      due_date: '2026-08-22',
      last_updated: '2026-08-21T12:00:00Z',
    });
    assert.equal('task_id' in publicPayload, false);
    assert.equal('customer_phone' in publicPayload, false);
    assert.equal('token' in publicPayload, false);
    assert.equal('created_by' in publicPayload, false);
  });
});

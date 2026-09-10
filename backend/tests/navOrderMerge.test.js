import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NAV_ORDER, mergeNavOrder } from '../utils/navOrderMerge.js';

describe('DEFAULT_NAV_ORDER', () => {
  it('matches Settings.jsx (mylist, no dispatch/crm/grand_opening)', () => {
    assert.deepEqual(DEFAULT_NAV_ORDER, [
      'dashboard',
      'mylist',
      'tasks',
      'time',
      'schedule',
      'inventory',
      'products',
      'profile',
      'admin'
    ]);
    assert.equal(DEFAULT_NAV_ORDER.includes('dispatch'), false);
    assert.equal(DEFAULT_NAV_ORDER.includes('crm'), false);
    assert.equal(DEFAULT_NAV_ORDER.includes('grand_opening'), false);
    assert.equal(DEFAULT_NAV_ORDER.includes('mylist'), true);
  });
});

describe('mergeNavOrder', () => {
  it('inserts missing default keys at their default index (clamped to length)', () => {
    assert.deepEqual(mergeNavOrder(['admin']), [
      'dashboard',
      'mylist',
      'tasks',
      'time',
      'schedule',
      'inventory',
      'products',
      'profile',
      'admin'
    ]);
    // Saved keys keep their relative positions; missing keys splice at defaultIdx.
    assert.deepEqual(mergeNavOrder(['admin', 'dashboard']), [
      'admin',
      'mylist',
      'tasks',
      'time',
      'schedule',
      'inventory',
      'products',
      'profile',
      'dashboard'
    ]);
  });

  it('returns a copy of defaults when saved is missing or not an array', () => {
    assert.deepEqual(mergeNavOrder(null), DEFAULT_NAV_ORDER);
    assert.deepEqual(mergeNavOrder('nope'), DEFAULT_NAV_ORDER);
    assert.notEqual(mergeNavOrder(null), DEFAULT_NAV_ORDER);
  });

  it('leaves a complete saved order unchanged (unknown keys stay)', () => {
    const custom = [...DEFAULT_NAV_ORDER.slice(1), 'dashboard', 'extra'];
    assert.deepEqual(mergeNavOrder(custom), custom);
  });
});

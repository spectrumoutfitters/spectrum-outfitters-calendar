import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS_DEFAULT_NAV_ORDER,
  SIDEBAR_DEFAULT_NAV_ORDER,
  mergeNavOrder
} from '../src/utils/navOrderMerge.js';

describe('nav default lists', () => {
  it('Settings matches backend (mylist); Sidebar adds dispatch/crm/grand_opening and drops mylist', () => {
    assert.deepEqual(SETTINGS_DEFAULT_NAV_ORDER, [
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
    assert.equal(SIDEBAR_DEFAULT_NAV_ORDER.includes('dispatch'), true);
    assert.equal(SIDEBAR_DEFAULT_NAV_ORDER.includes('crm'), true);
    assert.equal(SIDEBAR_DEFAULT_NAV_ORDER.includes('grand_opening'), true);
    assert.equal(SIDEBAR_DEFAULT_NAV_ORDER.includes('mylist'), false);
    assert.equal(SETTINGS_DEFAULT_NAV_ORDER.includes('dispatch'), false);
  });
});

describe('mergeNavOrder (Sidebar defaults)', () => {
  it('splices dispatch/crm/grand_opening into a backend-style saved order at Sidebar default indexes', () => {
    const backendSaved = [
      'dashboard',
      'mylist',
      'tasks',
      'time',
      'schedule',
      'inventory',
      'products',
      'profile',
      'admin'
    ];
    const merged = mergeNavOrder(backendSaved, SIDEBAR_DEFAULT_NAV_ORDER);
    assert.equal(merged.indexOf('dispatch'), 1);
    assert.ok(merged.includes('crm'));
    assert.ok(merged.includes('grand_opening'));
    assert.ok(merged.includes('mylist'));
    assert.equal(merged[0], 'dashboard');
  });
});

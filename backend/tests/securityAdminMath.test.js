import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampAuthHistoryLimit,
  parseAuthHistoryOffset,
  parseAuthHistorySuccess,
  parseAuthHistoryUserId,
  combineAuthHistoryEvents,
  filterAuthHistoryEventType,
  pageAuthHistoryEvents,
  isAllowedIPsInvalid,
  isGeofencePayloadInvalid,
  parsePurgeOlderThanDays,
} from '../utils/securityAdminMath.js';

describe('clampAuthHistoryLimit', () => {
  it('defaults and caps at 500; 0 / NaN become 100 via ||', () => {
    assert.equal(clampAuthHistoryLimit(), 100);
    assert.equal(clampAuthHistoryLimit('50'), 50);
    assert.equal(clampAuthHistoryLimit('600'), 500);
    assert.equal(clampAuthHistoryLimit('0'), 100);
    assert.equal(clampAuthHistoryLimit('abc'), 100);
  });
});

describe('parseAuthHistoryOffset', () => {
  it('keeps numeric offsets; NaN becomes 0; negatives are truthy and kept', () => {
    assert.equal(parseAuthHistoryOffset(), 0);
    assert.equal(parseAuthHistoryOffset('12'), 12);
    assert.equal(parseAuthHistoryOffset('abc'), 0);
    assert.equal(parseAuthHistoryOffset('-5'), -5);
  });
});

describe('parseAuthHistorySuccess / parseAuthHistoryUserId', () => {
  it('skips success filter for undefined and empty string but applies 0', () => {
    assert.deepEqual(parseAuthHistorySuccess(undefined), { apply: false, value: undefined });
    assert.deepEqual(parseAuthHistorySuccess(''), { apply: false, value: undefined });
    assert.deepEqual(parseAuthHistorySuccess('0'), { apply: true, value: 0 });
    assert.deepEqual(parseAuthHistorySuccess('1'), { apply: true, value: 1 });
  });

  it('skips user_id when falsy; parseInt of non-numeric is NaN but still applied', () => {
    assert.deepEqual(parseAuthHistoryUserId(undefined), { apply: false, value: undefined });
    assert.deepEqual(parseAuthHistoryUserId(''), { apply: false, value: undefined });
    assert.deepEqual(parseAuthHistoryUserId('9'), { apply: true, value: 9 });
    assert.equal(parseAuthHistoryUserId('nope').apply, true);
    assert.ok(Number.isNaN(parseAuthHistoryUserId('nope').value));
  });
});

describe('combineAuthHistoryEvents / filterAuthHistoryEventType / pageAuthHistoryEvents', () => {
  it('tags logouts as success 1 and sorts newest first', () => {
    const combined = combineAuthHistoryEvents(
      [{ id: 1, occurred_at: '2026-08-19T10:00:00.000Z' }],
      [{ id: 2, occurred_at: '2026-08-19T12:00:00.000Z' }]
    );
    assert.equal(combined[0].id, 2);
    assert.equal(combined[0].event_type, 'logout');
    assert.equal(combined[0].success, 1);
    assert.equal(combined[1].event_type, 'login');
    assert.equal(combined[1].success, undefined);
  });

  it('filters only exact login/logout; lookalikes keep both', () => {
    const combined = combineAuthHistoryEvents(
      [{ id: 1, occurred_at: '2026-08-19T10:00:00.000Z' }],
      [{ id: 2, occurred_at: '2026-08-19T11:00:00.000Z' }]
    );
    assert.equal(filterAuthHistoryEventType(combined, 'login').length, 1);
    assert.equal(filterAuthHistoryEventType(combined, 'logout').length, 1);
    assert.equal(filterAuthHistoryEventType(combined, 'Login').length, 2);
    assert.equal(filterAuthHistoryEventType(combined, undefined).length, 2);
  });

  it('pages after filter; total is the already-fetched combined length', () => {
    const combined = [
      { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
    ];
    const page = pageAuthHistoryEvents(combined, 1, 2);
    assert.equal(page.total, 4);
    assert.deepEqual(page.events.map((e) => e.id), [2, 3]);
  });
});

describe('isAllowedIPsInvalid / isGeofencePayloadInvalid', () => {
  it('requires allowedIPs to be an array', () => {
    assert.equal(isAllowedIPsInvalid(['1.1.1.1']), false);
    assert.equal(isAllowedIPsInvalid({}), true);
    assert.equal(isAllowedIPsInvalid('1.1.1.1'), true);
  });

  it('allows null geofence and 0,0,0; rejects missing fields', () => {
    assert.equal(isGeofencePayloadInvalid(null), false);
    assert.equal(isGeofencePayloadInvalid({ lat: 0, lng: 0, radiusMeters: 0 }), false);
    assert.equal(isGeofencePayloadInvalid({ lat: '29.7', lng: '-95.3', radiusMeters: '300' }), false);
    assert.equal(isGeofencePayloadInvalid({ lat: 29.7, lng: -95.3 }), true);
    assert.equal(isGeofencePayloadInvalid('nope'), true);
  });
});

describe('parsePurgeOlderThanDays', () => {
  it('defaults to 90; 0 is kept and would delete up to now', () => {
    assert.equal(parsePurgeOlderThanDays(), 90);
    assert.equal(parsePurgeOlderThanDays('30'), 30);
    assert.equal(parsePurgeOlderThanDays('0'), 0);
    assert.ok(Number.isNaN(parsePurgeOlderThanDays('abc')));
  });
});

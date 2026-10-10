import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { centralToUTC, toCentralDateTime } from '../src/utils/centralDateTimeLocal.js';

describe('time entry Central datetime-local conversion', () => {
  it('maps winter and summer punches onto Houston clock time and back', () => {
    assert.equal(toCentralDateTime('2026-01-15T14:30:00.000Z'), '2026-01-15T08:30');
    assert.equal(centralToUTC('2026-01-15T08:30'), '2026-01-15T14:30:00.000Z');

    assert.equal(toCentralDateTime('2026-07-15T13:30:00.000Z'), '2026-07-15T08:30');
    assert.equal(centralToUTC('2026-07-15T08:30'), '2026-07-15T13:30:00.000Z');
  });

  it('keeps midnight as 00:00 and shifts New Year UTC onto the prior Houston date', () => {
    assert.equal(toCentralDateTime('2026-01-15T06:00:00.000Z'), '2026-01-15T00:00');
    assert.equal(centralToUTC('2026-01-15T00:00'), '2026-01-15T06:00:00.000Z');

    assert.equal(toCentralDateTime('2026-07-15T05:00:00.000Z'), '2026-07-15T00:00');
    assert.equal(centralToUTC('2026-07-15T00:00'), '2026-07-15T05:00:00.000Z');

    assert.equal(toCentralDateTime('2026-01-01T05:30:00.000Z'), '2025-12-31T23:30');
    assert.equal(centralToUTC('2025-12-31T23:30'), '2026-01-01T05:30:00.000Z');
  });

  it('uses CDT after the spring change and CST after the fall change', () => {
    assert.equal(toCentralDateTime('2026-03-08T07:30:00.000Z'), '2026-03-08T01:30');
    assert.equal(centralToUTC('2026-03-08T01:30'), '2026-03-08T07:30:00.000Z');

    assert.equal(toCentralDateTime('2026-03-08T08:30:00.000Z'), '2026-03-08T03:30');
    assert.equal(centralToUTC('2026-03-08T03:30'), '2026-03-08T08:30:00.000Z');

    assert.equal(centralToUTC('2026-11-01T01:30'), '2026-11-01T07:30:00.000Z');
    assert.equal(toCentralDateTime('2026-11-01T06:30:00.000Z'), '2026-11-01T01:30');
    assert.equal(toCentralDateTime('2026-11-01T07:30:00.000Z'), '2026-11-01T01:30');
  });

  it('rejects empty and unparseable values instead of inventing a punch', () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      assert.equal(toCentralDateTime(''), '');
      assert.equal(toCentralDateTime(null), '');
      assert.equal(toCentralDateTime('not-a-date'), '');

      assert.equal(centralToUTC(''), null);
      assert.equal(centralToUTC(null), null);
      assert.equal(centralToUTC('2026-01-15'), null);
      assert.equal(centralToUTC('not-a-date'), null);
    } finally {
      console.warn = originalWarn;
    }
  });
});

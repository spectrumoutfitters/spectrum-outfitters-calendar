import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineMeters,
  evaluateClockInGeofence,
} from '../utils/clockInGeofence.js';

describe('haversineMeters', () => {
  it('returns ~0 for the same point', () => {
    assert.ok(haversineMeters(29.76, -95.37, 29.76, -95.37) < 1);
  });

  it('scales roughly with latitude degrees (~111km per degree)', () => {
    const meters = haversineMeters(29.0, -95.0, 30.0, -95.0);
    assert.ok(meters > 110_000 && meters < 112_000);
  });
});

describe('evaluateClockInGeofence', () => {
  const shop = { fenceLat: 29.76, fenceLng: -95.37, radiusMeters: 300 };

  it('skips checks when lat/lng missing or enforcement off', () => {
    assert.deepEqual(
      evaluateClockInGeofence({ lat: null, lng: null, ...shop, enforcement: 'hard' }),
      {
        allowed: true,
        distanceMeters: null,
        locationVerified: 0,
        geofenceWarning: null,
        violation: null,
      }
    );

    const off = evaluateClockInGeofence({
      lat: 29.76,
      lng: -95.37,
      ...shop,
      enforcement: 'off',
    });
    assert.equal(off.allowed, true);
    assert.equal(off.locationVerified, 0);
    assert.equal(off.distanceMeters, null);
  });

  it('skips when fence coords are missing', () => {
    const r = evaluateClockInGeofence({
      lat: 29.76,
      lng: -95.37,
      fenceLat: '',
      fenceLng: '',
      radiusMeters: 300,
      enforcement: 'hard',
    });
    assert.equal(r.allowed, true);
    assert.equal(r.locationVerified, 0);
  });

  it('marks verified when inside radius', () => {
    const r = evaluateClockInGeofence({
      lat: 29.76,
      lng: -95.37,
      ...shop,
      enforcement: 'hard',
    });
    assert.equal(r.allowed, true);
    assert.equal(r.locationVerified, 1);
    assert.equal(r.violation, null);
    assert.ok(r.distanceMeters < 1);
  });

  it('hard enforcement denies outside radius', () => {
    const r = evaluateClockInGeofence({
      lat: 29.80,
      lng: -95.37,
      ...shop,
      enforcement: 'hard',
    });
    assert.equal(r.allowed, false);
    assert.equal(r.locationVerified, 0);
    assert.equal(r.violation?.code, 'GEOFENCE_VIOLATION');
    assert.ok(r.violation.distanceMeters > 300);
    assert.equal(r.violation.radiusMeters, 300);
  });

  it('soft enforcement allows with warning outside radius', () => {
    const r = evaluateClockInGeofence({
      lat: 29.80,
      lng: -95.37,
      ...shop,
      enforcement: 'soft',
    });
    assert.equal(r.allowed, true);
    assert.equal(r.locationVerified, 0);
    assert.equal(r.violation, null);
    assert.ok(r.geofenceWarning);
    assert.match(r.geofenceWarning.message, /flagged/);
    assert.equal(r.geofenceWarning.radiusMeters, 300);
  });

  it('defaults radius to 300 when unset', () => {
    const r = evaluateClockInGeofence({
      lat: 29.80,
      lng: -95.37,
      fenceLat: 29.76,
      fenceLng: -95.37,
      radiusMeters: undefined,
      enforcement: 'hard',
    });
    assert.equal(r.allowed, false);
    assert.equal(r.violation.radiusMeters, 300);
  });
});

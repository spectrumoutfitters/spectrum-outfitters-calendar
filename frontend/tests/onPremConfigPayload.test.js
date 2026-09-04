import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAllowedIpLines,
  buildOnPremGeofence,
  buildOnPremConfigPayload,
} from '../src/utils/onPremConfigPayload.js';

describe('parseAllowedIpLines', () => {
  it('splits on newline, trims, and drops empty / whitespace lines', () => {
    assert.deepEqual(parseAllowedIpLines('10.0.0.1\n  10.0.0.2/24  \n\n\t\n'), [
      '10.0.0.1',
      '10.0.0.2/24',
    ]);
  });

  it('keeps truthy tokens including "0"', () => {
    assert.deepEqual(parseAllowedIpLines('0\nfalse'), ['0', 'false']);
  });

  it('treats null / undefined as no lines', () => {
    assert.deepEqual(parseAllowedIpLines(null), []);
    assert.deepEqual(parseAllowedIpLines(undefined), []);
    assert.deepEqual(parseAllowedIpLines(''), []);
  });
});

describe('buildOnPremGeofence', () => {
  it('requires all three fields to be truthy before parsing', () => {
    assert.deepEqual(buildOnPremGeofence('29.7', '-95.3', '150'), {
      lat: 29.7,
      lng: -95.3,
      radiusMeters: 150,
    });
  });

  it('numeric 0 / empty string wipe the fence; string "0" is kept', () => {
    assert.equal(buildOnPremGeofence(0, '-95.3', '150'), null);
    assert.equal(buildOnPremGeofence('29.7', 0, '150'), null);
    assert.equal(buildOnPremGeofence('29.7', '-95.3', 0), null);
    assert.equal(buildOnPremGeofence('', '-95.3', '150'), null);
    assert.deepEqual(buildOnPremGeofence('0', '0', '0'), {
      lat: 0,
      lng: 0,
      radiusMeters: 0,
    });
  });

  it('parseFloat of non-numeric truthy strings yields NaN fields (not a wipe)', () => {
    const fence = buildOnPremGeofence('abc', 'def', 'ghi');
    assert.ok(fence);
    assert.ok(Number.isNaN(fence.lat));
    assert.ok(Number.isNaN(fence.lng));
    assert.ok(Number.isNaN(fence.radiusMeters));
  });
});

describe('buildOnPremConfigPayload', () => {
  it('combines IP lines and geofence', () => {
    assert.deepEqual(
      buildOnPremConfigPayload({
        allowedIpText: '10.0.0.1\n\n',
        lat: '29.7',
        lng: '-95.3',
        radius: '100',
      }),
      {
        allowedIPs: ['10.0.0.1'],
        geofence: { lat: 29.7, lng: -95.3, radiusMeters: 100 },
      },
    );
  });

  it('defaults to empty IPs and null geofence', () => {
    assert.deepEqual(buildOnPremConfigPayload(), {
      allowedIPs: [],
      geofence: null,
    });
  });
});

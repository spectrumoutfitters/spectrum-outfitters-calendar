import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { haversineMeters, scoreOnPremPresence } from '../utils/onPremScore.js';

const SHOP = { lat: 29.76, lng: -95.37 };

function atShop() {
  return { lat: SHOP.lat, lng: SHOP.lng };
}

function northOfShop(degrees) {
  return { lat: SHOP.lat + degrees, lng: SHOP.lng };
}

describe('scoreOnPremPresence', () => {
  it('gives partial credit without marking network or geo ok when nothing is configured', () => {
    const result = scoreOnPremPresence({
      ip: '203.0.113.10',
      allowedIPs: [],
      geofence: null,
      browserGeo: atShop(),
      ipGeo: atShop(),
    });
    assert.deepEqual(result, { networkOk: false, geoOk: false, score: 50 });
  });

  it('awards network points only when the IP is allowlisted, including CIDR and IPv4-mapped addresses', () => {
    const geofence = null;
    const hit = scoreOnPremPresence({
      ip: '::ffff:10.1.2.3',
      allowedIPs: ['10.1.0.0/16'],
      geofence,
      browserGeo: null,
      ipGeo: null,
    });
    assert.equal(hit.networkOk, true);
    assert.equal(hit.geoOk, false);
    assert.equal(hit.score, 75);

    const miss = scoreOnPremPresence({
      ip: '10.2.0.1',
      allowedIPs: ['10.1.0.0/16', '203.0.113.10'],
      geofence,
      browserGeo: null,
      ipGeo: null,
    });
    assert.equal(miss.networkOk, false);
    assert.equal(miss.geoOk, false);
    assert.equal(miss.score, 25);
  });

  it('counts browser geo on the radius boundary and keeps equator coordinates (lat 0)', () => {
    const radius = haversineMeters(SHOP.lat, SHOP.lng, SHOP.lat + 0.001, SHOP.lng);
    const onEdge = scoreOnPremPresence({
      ip: '203.0.113.10',
      allowedIPs: ['203.0.113.10'],
      geofence: { ...SHOP, radiusMeters: radius },
      browserGeo: northOfShop(0.001),
      ipGeo: null,
    });
    assert.equal(onEdge.networkOk, true);
    assert.equal(onEdge.geoOk, true);
    assert.equal(onEdge.score, 80);

    const equator = scoreOnPremPresence({
      ip: '203.0.113.10',
      allowedIPs: [],
      geofence: { lat: 0, lng: 0, radiusMeters: 50 },
      browserGeo: { lat: 0, lng: 0 },
      ipGeo: null,
    });
    assert.equal(equator.geoOk, true);
    assert.equal(equator.score, 25 + 30);
  });

  it('splits browser radius from the looser 3x IP-geo radius', () => {
    const geofence = { ...SHOP, radiusMeters: 150 };
    const base = {
      ip: '203.0.113.10',
      allowedIPs: ['203.0.113.10'],
      geofence,
    };

    const insideBoth = scoreOnPremPresence({
      ...base,
      browserGeo: northOfShop(0.001),
      ipGeo: northOfShop(0.001),
    });
    assert.equal(insideBoth.geoOk, true);
    assert.equal(insideBoth.score, 100);

    const ipOnly = scoreOnPremPresence({
      ...base,
      browserGeo: northOfShop(0.002),
      ipGeo: northOfShop(0.002),
    });
    assert.equal(ipOnly.geoOk, false);
    assert.equal(ipOnly.score, 70);

    const outsideBoth = scoreOnPremPresence({
      ...base,
      browserGeo: northOfShop(0.005),
      ipGeo: northOfShop(0.005),
    });
    assert.equal(outsideBoth.geoOk, false);
    assert.equal(outsideBoth.score, 50);
  });

  it('does not award geo points when a geofence is set but coordinates are missing', () => {
    const result = scoreOnPremPresence({
      ip: '203.0.113.10',
      allowedIPs: ['203.0.113.10'],
      geofence: { ...SHOP, radiusMeters: 150 },
      browserGeo: { lat: null, lng: SHOP.lng },
      ipGeo: { lng: SHOP.lng },
    });
    assert.deepEqual(result, { networkOk: true, geoOk: false, score: 50 });
  });
});

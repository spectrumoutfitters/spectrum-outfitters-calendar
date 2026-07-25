import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getClientIP, getSocketClientIP, lookupIPGeo } from '../utils/security.js';

describe('getClientIP', () => {
  it('prefers x-real-ip over x-forwarded-for and req.ip', () => {
    const ip = getClientIP({
      headers: {
        'x-real-ip': '10.0.0.8',
        'x-forwarded-for': '1.1.1.1, 2.2.2.2'
      },
      ip: '9.9.9.9'
    });
    assert.equal(ip, '10.0.0.8');
  });

  it('uses the first x-forwarded-for hop when real-ip is absent', () => {
    const ip = getClientIP({
      headers: { 'x-forwarded-for': ' 203.0.113.10, 198.51.100.1 ' },
      ip: '9.9.9.9'
    });
    assert.equal(ip, '203.0.113.10');
  });

  it('falls back to req.ip, then socket remoteAddress, then unknown', () => {
    assert.equal(getClientIP({ headers: {}, ip: '192.0.2.1' }), '192.0.2.1');
    assert.equal(
      getClientIP({ headers: {}, socket: { remoteAddress: '192.0.2.2' } }),
      '192.0.2.2'
    );
    assert.equal(getClientIP({ headers: {} }), 'unknown');
  });
});

describe('getSocketClientIP', () => {
  it('prefers handshake x-real-ip, then first forwarded hop, then address', () => {
    assert.equal(
      getSocketClientIP({
        handshake: {
          headers: {
            'x-real-ip': '10.0.0.9',
            'x-forwarded-for': '1.1.1.1, 2.2.2.2'
          },
          address: '9.9.9.9'
        }
      }),
      '10.0.0.9'
    );
    assert.equal(
      getSocketClientIP({
        handshake: {
          headers: { 'x-forwarded-for': ' 198.51.100.20, 203.0.113.1 ' },
          address: '9.9.9.9'
        }
      }),
      '198.51.100.20'
    );
    assert.equal(
      getSocketClientIP({ handshake: { headers: {}, address: '192.0.2.3' } }),
      '192.0.2.3'
    );
    assert.equal(getSocketClientIP({ handshake: { headers: {} } }), 'unknown');
  });
});

describe('lookupIPGeo', () => {
  it('returns null for missing, unknown, and loopback addresses', () => {
    assert.equal(lookupIPGeo(null), null);
    assert.equal(lookupIPGeo('unknown'), null);
    assert.equal(lookupIPGeo('127.0.0.1'), null);
    assert.equal(lookupIPGeo('::1'), null);
  });

  it('looks up a public IP and strips IPv4-mapped IPv6 prefixes', () => {
    const geo = lookupIPGeo('::ffff:8.8.8.8');
    assert.ok(geo);
    assert.equal(geo.country, 'US');
    assert.equal(geo.source, 'geoip-lite/maxmind');
    assert.equal(typeof geo.lat, 'number');
    assert.equal(typeof geo.lng, 'number');
  });
});

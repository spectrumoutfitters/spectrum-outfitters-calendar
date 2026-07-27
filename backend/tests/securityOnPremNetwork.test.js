import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cidrMatch,
  haversineMeters,
  ipMatchesAllowlist,
  ipToLong,
} from '../utils/security.js';

describe('ipToLong / cidrMatch', () => {
  it('encodes IPv4 octets as uint32', () => {
    assert.equal(ipToLong('0.0.0.0'), 0);
    assert.equal(ipToLong('127.0.0.1'), (127 << 24) >>> 0);
    assert.equal(ipToLong('255.255.255.255'), 0xffffffff);
  });

  it('rejects non-IPv4 values', () => {
    assert.equal(ipToLong('::1'), null);
    assert.equal(ipToLong('1.2.3'), null);
    assert.equal(ipToLong('not-an-ip'), null);
  });

  it('matches addresses inside a /24 and rejects outside', () => {
    assert.equal(cidrMatch('192.168.1.50', '192.168.1.0/24'), true);
    assert.equal(cidrMatch('192.168.1.255', '192.168.1.0/24'), true);
    assert.equal(cidrMatch('192.168.2.1', '192.168.1.0/24'), false);
  });

  it('supports host /32 and broader /16 ranges', () => {
    assert.equal(cidrMatch('10.0.0.8', '10.0.0.8/32'), true);
    assert.equal(cidrMatch('10.0.0.9', '10.0.0.8/32'), false);
    assert.equal(cidrMatch('10.0.9.1', '10.0.0.0/16'), true);
    assert.equal(cidrMatch('10.1.0.1', '10.0.0.0/16'), false);
  });
});

describe('ipMatchesAllowlist', () => {
  it('matches exact IPs and strips IPv4-mapped IPv6 prefix', () => {
    assert.equal(ipMatchesAllowlist('203.0.113.10', ['203.0.113.10']), true);
    assert.equal(ipMatchesAllowlist('::ffff:203.0.113.10', ['203.0.113.10']), true);
    assert.equal(ipMatchesAllowlist('203.0.113.11', ['203.0.113.10']), false);
  });

  it('matches CIDR entries in the allowlist', () => {
    assert.equal(ipMatchesAllowlist('10.1.2.3', ['10.1.0.0/16', '192.168.0.1']), true);
    assert.equal(ipMatchesAllowlist('11.0.0.1', ['10.1.0.0/16']), false);
  });

  it('returns false for empty allowlist or missing IP', () => {
    assert.equal(ipMatchesAllowlist('', ['10.0.0.1']), false);
    assert.equal(ipMatchesAllowlist('10.0.0.1', []), false);
    assert.equal(ipMatchesAllowlist('10.0.0.1', null), false);
  });
});

describe('haversineMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    assert.ok(haversineMeters(29.76, -95.37, 29.76, -95.37) < 1);
  });

  it('is roughly 111km per degree of latitude near Houston', () => {
    const meters = haversineMeters(29.0, -95.0, 30.0, -95.0);
    assert.ok(meters > 100_000 && meters < 120_000, `got ${meters}`);
  });
});

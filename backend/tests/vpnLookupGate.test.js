import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSkipVpnLookup } from '../utils/vpnLookupGate.js';

describe('shouldSkipVpnLookup', () => {
  it('skips when the contact email is missing or blank', () => {
    assert.equal(shouldSkipVpnLookup('203.0.113.10', undefined), true);
    assert.equal(shouldSkipVpnLookup('203.0.113.10', ''), true);
    assert.equal(shouldSkipVpnLookup('203.0.113.10', '   '), true);
    assert.equal(shouldSkipVpnLookup('203.0.113.10', null), true);
  });

  it('skips loopback and unknown IPs even when a contact is configured', () => {
    const contact = 'ops@example.com';
    assert.equal(shouldSkipVpnLookup('127.0.0.1', contact), true);
    assert.equal(shouldSkipVpnLookup('::1', contact), true);
    assert.equal(shouldSkipVpnLookup('unknown', contact), true);
    assert.equal(shouldSkipVpnLookup('', contact), true);
    assert.equal(shouldSkipVpnLookup(null, contact), true);
  });

  it('allows a lookup only for a public IP with a trimmed contact', () => {
    assert.equal(shouldSkipVpnLookup('203.0.113.10', ' ops@example.com '), false);
    assert.equal(shouldSkipVpnLookup('8.8.8.8', 'ops@example.com'), false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getClientIpFromRequest } from '../src/lib/clientIp.ts';

describe('getClientIpFromRequest', () => {
  it('uses the first x-forwarded-for hop', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': ' 203.0.113.9, 198.51.100.1 ' }
    });
    assert.equal(getClientIpFromRequest(request), '203.0.113.9');
  });

  it('falls back to x-real-ip, then unknown', () => {
    const withReal = new Request('https://example.com', {
      headers: { 'x-real-ip': ' 192.0.2.44 ' }
    });
    assert.equal(getClientIpFromRequest(withReal), '192.0.2.44');
    assert.equal(getClientIpFromRequest(new Request('https://example.com')), 'unknown');
  });
});

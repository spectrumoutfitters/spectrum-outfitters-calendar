import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getClientIpFromRequest } from '../src/lib/clientIp.ts';

function requestWith(headers) {
  return new Request('https://raffle.example.com/api/entry', { headers });
}

describe('getClientIpFromRequest', () => {
  it('uses only the first X-Forwarded-For hop, trimmed', () => {
    const request = requestWith({
      'x-forwarded-for': '  203.0.113.10  , 198.51.100.8',
      'x-real-ip': '192.0.2.50',
    });
    assert.equal(getClientIpFromRequest(request), '203.0.113.10');
  });

  it('keeps an IPv6 first hop intact instead of splitting on colons', () => {
    const request = requestWith({
      'x-forwarded-for': '2001:db8:1::10, 198.51.100.1',
    });
    assert.equal(getClientIpFromRequest(request), '2001:db8:1::10');
  });

  it('does not adopt a later proxy or X-Real-IP when the first hop is blank', () => {
    const commaFirst = requestWith({
      'x-forwarded-for': ', 198.51.100.8',
      'x-real-ip': '203.0.113.20',
    });
    const spacesFirst = requestWith({
      'x-forwarded-for': '   , 198.51.100.8',
      'x-real-ip': '203.0.113.20',
    });

    assert.equal(getClientIpFromRequest(commaFirst), 'unknown');
    assert.equal(getClientIpFromRequest(spacesFirst), 'unknown');
  });

  it('uses X-Real-IP when X-Forwarded-For is only whitespace', () => {
    const request = requestWith({
      'x-forwarded-for': '   ',
      'x-real-ip': '  203.0.113.20  ',
    });
    assert.equal(getClientIpFromRequest(request), '203.0.113.20');
  });

  it('trims X-Real-IP only when X-Forwarded-For is absent', () => {
    const request = requestWith({ 'x-real-ip': '  2001:db8::5  ' });
    assert.equal(getClientIpFromRequest(request), '2001:db8::5');
  });

  it('returns unknown when neither forwarding header is present', () => {
    assert.equal(getClientIpFromRequest(requestWith({})), 'unknown');
  });
});

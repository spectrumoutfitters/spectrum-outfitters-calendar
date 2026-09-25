import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSING_API_BASE_ERROR,
  loginEventsEndpoint,
  resolveSpectrumApiUrl,
  spectrumApiHeaders,
} from '../spectrumApiRequest.js';

describe('resolveSpectrumApiUrl', () => {
  it('throws before building a URL when the base is missing', () => {
    for (const base of ['', undefined, null]) {
      assert.throws(
        () => resolveSpectrumApiUrl(base, '/health'),
        (err) => err instanceof Error && err.message === MISSING_API_BASE_ERROR,
      );
    }
  });

  it('strips trailing slashes and joins a relative endpoint', () => {
    assert.equal(
      resolveSpectrumApiUrl('https://login.spectrumoutfitters.com/api///', '/health'),
      'https://login.spectrumoutfitters.com/api/health',
    );
    assert.equal(
      resolveSpectrumApiUrl('https://login.spectrumoutfitters.com/api', '/admin/security/active-sessions'),
      'https://login.spectrumoutfitters.com/api/admin/security/active-sessions',
    );
  });

  it('does not insert a slash when the endpoint omits one', () => {
    assert.equal(
      resolveSpectrumApiUrl('https://login.spectrumoutfitters.com/api', 'health'),
      'https://login.spectrumoutfitters.com/apihealth',
    );
  });

  it('uses http(s) endpoints as-is and still prefixes other schemes', () => {
    assert.equal(
      resolveSpectrumApiUrl('https://login.spectrumoutfitters.com/api', 'https://other.example/health'),
      'https://other.example/health',
    );
    assert.equal(
      resolveSpectrumApiUrl('https://login.spectrumoutfitters.com/api', 'HTTPS://other.example/health'),
      'https://login.spectrumoutfitters.com/apiHTTPS://other.example/health',
    );
  });
});

describe('spectrumApiHeaders', () => {
  it('omits Authorization when no admin token is configured', () => {
    const headers = spectrumApiHeaders('', { Accept: 'application/json' });
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers.Accept, 'application/json');
    assert.equal(headers['User-Agent'], 'SpectrumMCP/1.0');
  });

  it('sets Bearer from the admin token and lets a caller override User-Agent', () => {
    const headers = spectrumApiHeaders('secret-token', {
      'User-Agent': 'custom',
      Authorization: 'Bearer stale',
    });
    assert.equal(headers.Authorization, 'Bearer secret-token');
    assert.equal(headers['User-Agent'], 'custom');
  });

  it('keeps a caller Authorization header when the admin token is empty', () => {
    const headers = spectrumApiHeaders(undefined, { Authorization: 'Bearer caller' });
    assert.equal(headers.Authorization, 'Bearer caller');
  });
});

describe('loginEventsEndpoint', () => {
  it('defaults limit and offset for the security audit query', () => {
    assert.equal(loginEventsEndpoint(), '/admin/security/login-events?limit=50&offset=0');
  });

  it('interpolates the requested page', () => {
    assert.equal(loginEventsEndpoint(10, 20), '/admin/security/login-events?limit=10&offset=20');
  });
});

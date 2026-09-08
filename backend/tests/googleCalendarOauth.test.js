import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  firstQueryParam,
  oauthFallbackRedirectUrl,
  oauthPostMessageTargetOrigin,
} from '../utils/googleCalendarOauth.js';

describe('firstQueryParam', () => {
  it('returns undefined for null, empty, whitespace, and non-strings', () => {
    assert.equal(firstQueryParam(null), undefined);
    assert.equal(firstQueryParam(undefined), undefined);
    assert.equal(firstQueryParam(''), undefined);
    assert.equal(firstQueryParam('   '), undefined);
    assert.equal(firstQueryParam(0), undefined);
    assert.equal(firstQueryParam(12), undefined);
  });

  it('trims strings and takes the first array element', () => {
    assert.equal(firstQueryParam('  abc123  '), 'abc123');
    assert.equal(firstQueryParam(['  code  ', 'ignored']), 'code');
    assert.equal(firstQueryParam(['', 'second']), undefined);
    assert.equal(firstQueryParam([]), undefined);
  });
});

describe('oauthPostMessageTargetOrigin', () => {
  it('uses FRONTEND_URL origin and prepends https when protocol is missing', () => {
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_URL: 'https://app.example.com/admin?x=1' }),
      'https://app.example.com'
    );
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_URL: 'app.example.com' }),
      'https://app.example.com'
    );
  });

  it('falls back to PUBLIC_FRONTEND_ORIGIN, then localhost; only HTTPS=1 flips scheme', () => {
    assert.equal(
      oauthPostMessageTargetOrigin({ PUBLIC_FRONTEND_ORIGIN: 'http://staff.local:4173/path' }),
      'http://staff.local:4173'
    );
    assert.equal(oauthPostMessageTargetOrigin({}), 'http://localhost:5173');
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_PORT: '3000', FRONTEND_USE_HTTPS: '1' }),
      'https://localhost:3000'
    );
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_USE_HTTPS: 'true' }),
      'http://localhost:5173'
    );
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_URL: 'http://[not-a-url' }),
      'http://localhost:5173'
    );
  });
});

describe('oauthFallbackRedirectUrl', () => {
  it('keeps protocolled FRONTEND_URL (strip trailing slashes) and ignores PUBLIC_FRONTEND_ORIGIN', () => {
    assert.equal(
      oauthFallbackRedirectUrl({ FRONTEND_URL: 'https://app.example.com/calendar///' }),
      'https://app.example.com/calendar'
    );
    assert.equal(
      oauthFallbackRedirectUrl({ PUBLIC_FRONTEND_ORIGIN: 'https://other.example.com' }),
      'http://localhost:5173'
    );
    assert.equal(
      oauthFallbackRedirectUrl({ FRONTEND_URL: 'app.example.com' }),
      'http://localhost:5173'
    );
    assert.equal(
      oauthFallbackRedirectUrl({ FRONTEND_PORT: '4173', FRONTEND_USE_HTTPS: '1' }),
      'https://localhost:4173'
    );
  });
});

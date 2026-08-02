import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRedirectUriOkForConnect,
  checkGoogleOAuthRedirectUri,
  getGoogleOAuthRedirectUri,
} from '../utils/googleOAuthRedirectGuard.js';

describe('getGoogleOAuthRedirectUri', () => {
  it('uses explicit GOOGLE_REDIRECT_URI when set', () => {
    assert.equal(
      getGoogleOAuthRedirectUri({
        GOOGLE_REDIRECT_URI: ' https://shop.example.com/api/google-calendar/callback ',
        PORT: '9999',
      }),
      'https://shop.example.com/api/google-calendar/callback'
    );
  });

  it('defaults to localhost callback using PORT', () => {
    assert.equal(
      getGoogleOAuthRedirectUri({ PORT: '5001' }),
      'http://localhost:5001/api/google-calendar/callback'
    );
    assert.equal(
      getGoogleOAuthRedirectUri({}),
      'http://localhost:5000/api/google-calendar/callback'
    );
  });
});

describe('checkGoogleOAuthRedirectUri / assertRedirectUriOkForConnect', () => {
  it('throws in production when GOOGLE_REDIRECT_URI is unset', () => {
    const result = checkGoogleOAuthRedirectUri({ NODE_ENV: 'production' });
    assert.equal(result.ok, false);
    assert.match(result.error.message, /GOOGLE_REDIRECT_URI/);

    assert.throws(
      () => assertRedirectUriOkForConnect({ NODE_ENV: 'production' }),
      /GOOGLE_REDIRECT_URI/
    );
  });

  it('allows production when a public redirect URI is configured', () => {
    const result = checkGoogleOAuthRedirectUri({
      NODE_ENV: 'production',
      GOOGLE_REDIRECT_URI: 'https://shop.example.com/api/google-calendar/callback',
    });
    assert.deepEqual(result, { ok: true });
    assert.doesNotThrow(() =>
      assertRedirectUriOkForConnect({
        NODE_ENV: 'production',
        GOOGLE_REDIRECT_URI: 'https://shop.example.com/api/google-calendar/callback',
      })
    );
  });

  it('warns (does not throw) when production redirect still points at localhost', () => {
    const warnings = [];
    const result = checkGoogleOAuthRedirectUri({
      NODE_ENV: 'production',
      GOOGLE_REDIRECT_URI: 'http://localhost:5000/api/google-calendar/callback',
    });
    assert.equal(result.ok, true);
    assert.match(result.warning, /localhost/);

    assertRedirectUriOkForConnect(
      {
        NODE_ENV: 'production',
        GOOGLE_REDIRECT_URI: 'http://127.0.0.1:5000/api/google-calendar/callback',
      },
      { warn: (msg) => warnings.push(msg) }
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /127\.0\.0\.1|localhost/);
  });

  it('skips checks when SKIP_OAUTH_REDIRECT_CHECK=1', () => {
    assert.deepEqual(
      checkGoogleOAuthRedirectUri({
        NODE_ENV: 'production',
        SKIP_OAUTH_REDIRECT_CHECK: '1',
      }),
      { ok: true }
    );
  });

  it('allows missing redirect URI outside production', () => {
    assert.deepEqual(checkGoogleOAuthRedirectUri({ NODE_ENV: 'development' }), { ok: true });
  });
});

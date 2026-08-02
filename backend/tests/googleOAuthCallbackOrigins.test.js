import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  firstQueryParam,
  oauthFallbackRedirectUrl,
  oauthPostMessageTargetOrigin,
} from '../utils/googleOAuthCallbackOrigins.js';

describe('firstQueryParam', () => {
  it('returns undefined for nullish / blank values', () => {
    assert.equal(firstQueryParam(undefined), undefined);
    assert.equal(firstQueryParam(null), undefined);
    assert.equal(firstQueryParam(''), undefined);
    assert.equal(firstQueryParam('   '), undefined);
    assert.equal(firstQueryParam([]), undefined);
  });

  it('trims strings and takes the first array element', () => {
    assert.equal(firstQueryParam('  code-1  '), 'code-1');
    assert.equal(firstQueryParam(['  a  ', 'b']), 'a');
    assert.equal(firstQueryParam(['', 'b']), undefined);
  });
});

describe('oauthPostMessageTargetOrigin', () => {
  it('parses FRONTEND_URL origin including path stripping', () => {
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_URL: 'https://app.example.com/so-app/' }),
      'https://app.example.com'
    );
  });

  it('assumes https when FRONTEND_URL has no scheme', () => {
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_URL: 'calendar.example.com' }),
      'https://calendar.example.com'
    );
  });

  it('falls back to PUBLIC_FRONTEND_ORIGIN then localhost Vite', () => {
    assert.equal(
      oauthPostMessageTargetOrigin({ PUBLIC_FRONTEND_ORIGIN: 'http://127.0.0.1:4173/admin' }),
      'http://127.0.0.1:4173'
    );
    assert.equal(oauthPostMessageTargetOrigin({}), 'http://localhost:5173');
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_PORT: '3000', FRONTEND_USE_HTTPS: '1' }),
      'https://localhost:3000'
    );
  });

  it('falls through invalid URL strings to localhost', () => {
    assert.equal(
      oauthPostMessageTargetOrigin({ FRONTEND_URL: 'http://[not-a-valid-url' }),
      'http://localhost:5173'
    );
  });
});

describe('oauthFallbackRedirectUrl', () => {
  it('keeps scheme URLs and strips trailing slashes', () => {
    assert.equal(
      oauthFallbackRedirectUrl({ FRONTEND_URL: 'https://app.example.com/so-app///' }),
      'https://app.example.com/so-app'
    );
  });

  it('ignores scheme-less FRONTEND_URL and uses local Vite defaults', () => {
    assert.equal(
      oauthFallbackRedirectUrl({ FRONTEND_URL: 'app.example.com' }),
      'http://localhost:5173'
    );
    assert.equal(
      oauthFallbackRedirectUrl({ FRONTEND_PORT: '5180', FRONTEND_USE_HTTPS: '1' }),
      'https://localhost:5180'
    );
  });
});

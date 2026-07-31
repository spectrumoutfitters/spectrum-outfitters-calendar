import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { getAppsScriptUrl, getRaffleSiteOrigin } from '../src/lib/env.ts';

const KEYS = ['APPS_SCRIPT_URL', 'NEXT_PUBLIC_RAFFLE_SITE_URL', 'RAFFLE_SITE_URL'];
const originals = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (originals[k] === undefined) delete process.env[k];
    else process.env[k] = originals[k];
  }
});

describe('getAppsScriptUrl', () => {
  it('returns null for missing, blank, or whitespace-only values', () => {
    delete process.env.APPS_SCRIPT_URL;
    assert.equal(getAppsScriptUrl(), null);

    process.env.APPS_SCRIPT_URL = '   ';
    assert.equal(getAppsScriptUrl(), null);
  });

  it('trims a configured Apps Script URL', () => {
    process.env.APPS_SCRIPT_URL = ' https://script.google.com/macros/s/abc/exec ';
    assert.equal(getAppsScriptUrl(), 'https://script.google.com/macros/s/abc/exec');
  });
});

describe('getRaffleSiteOrigin', () => {
  it('prefers NEXT_PUBLIC_RAFFLE_SITE_URL and strips a trailing slash', () => {
    process.env.NEXT_PUBLIC_RAFFLE_SITE_URL = 'https://raffle.example.com/';
    process.env.RAFFLE_SITE_URL = 'https://ignored.example.com';
    assert.equal(getRaffleSiteOrigin(), 'https://raffle.example.com');
  });

  it('falls back to RAFFLE_SITE_URL when public URL is unset', () => {
    delete process.env.NEXT_PUBLIC_RAFFLE_SITE_URL;
    process.env.RAFFLE_SITE_URL = ' https://fallback.example.com/ ';
    assert.equal(getRaffleSiteOrigin(), 'https://fallback.example.com');
  });

  it('returns empty string when neither origin env is set', () => {
    delete process.env.NEXT_PUBLIC_RAFFLE_SITE_URL;
    delete process.env.RAFFLE_SITE_URL;
    assert.equal(getRaffleSiteOrigin(), '');
  });
});

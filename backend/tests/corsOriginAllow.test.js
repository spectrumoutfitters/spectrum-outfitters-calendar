import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECTRUM_PRODUCTION_ORIGIN_RE,
  isAllowedCorsOrigin,
  isLocalNetworkOrigin,
  parseAllowedOriginsList,
  productionOriginRegexForEnv,
} from '../utils/corsOriginAllow.js';

describe('parseAllowedOriginsList', () => {
  it('splits, trims, and drops empty segments', () => {
    assert.deepEqual(parseAllowedOriginsList(' https://a.com , ,https://b.com '), [
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('returns empty for missing or blank csv', () => {
    assert.deepEqual(parseAllowedOriginsList(''), []);
    assert.deepEqual(parseAllowedOriginsList(null), []);
    assert.deepEqual(parseAllowedOriginsList(undefined), []);
  });
});

describe('productionOriginRegexForEnv', () => {
  it('only enables the spectrumoutfitters.com regex in production', () => {
    assert.equal(productionOriginRegexForEnv('production'), SPECTRUM_PRODUCTION_ORIGIN_RE);
    assert.equal(productionOriginRegexForEnv('development'), null);
    assert.equal(productionOriginRegexForEnv(undefined), null);
  });
});

describe('isLocalNetworkOrigin', () => {
  it('allows RFC1918 and loopback HTTP/HTTPS origins', () => {
    assert.equal(isLocalNetworkOrigin('http://192.168.1.20:5173'), true);
    assert.equal(isLocalNetworkOrigin('https://10.0.0.8'), true);
    assert.equal(isLocalNetworkOrigin('http://172.16.0.1'), true);
    assert.equal(isLocalNetworkOrigin('http://172.31.255.1'), true);
    assert.equal(isLocalNetworkOrigin('https://localhost:5173'), true);
    assert.equal(isLocalNetworkOrigin('http://127.0.0.1:5173'), true);
  });

  it('rejects 172.x outside 16–31 and public hosts', () => {
    assert.equal(isLocalNetworkOrigin('http://172.15.0.1'), false);
    assert.equal(isLocalNetworkOrigin('http://172.32.0.1'), false);
    assert.equal(isLocalNetworkOrigin('https://evil.example'), false);
    assert.equal(isLocalNetworkOrigin(''), false);
  });
});

describe('isAllowedCorsOrigin', () => {
  const allowedOrigins = ['http://localhost:5173', 'https://app.example:443'];

  it('allows missing origin (curl / native clients)', () => {
    assert.equal(isAllowedCorsOrigin('', { allowedOrigins }), true);
    assert.equal(isAllowedCorsOrigin(null, { allowedOrigins }), true);
  });

  it('matches allowlist prefixes after stripping a trailing :port', () => {
    assert.equal(isAllowedCorsOrigin('http://localhost:5173', { allowedOrigins }), true);
    assert.equal(isAllowedCorsOrigin('http://localhost:9999', { allowedOrigins }), true);
    assert.equal(isAllowedCorsOrigin('https://app.example', { allowedOrigins }), true);
  });

  it('allows production spectrumoutfitters.com hosts when the regex is set', () => {
    assert.equal(
      isAllowedCorsOrigin('https://login.spectrumoutfitters.com', {
        productionOriginRegex: SPECTRUM_PRODUCTION_ORIGIN_RE,
      }),
      true,
    );
    assert.equal(
      isAllowedCorsOrigin('https://spectrumoutfitters.com:443', {
        productionOriginRegex: SPECTRUM_PRODUCTION_ORIGIN_RE,
      }),
      true,
    );
    assert.equal(
      isAllowedCorsOrigin('https://spectrumoutfitters.com.evil.com', {
        productionOriginRegex: SPECTRUM_PRODUCTION_ORIGIN_RE,
      }),
      false,
    );
  });

  it('does not apply the production regex outside production', () => {
    assert.equal(
      isAllowedCorsOrigin('https://login.spectrumoutfitters.com', { productionOriginRegex: null }),
      false,
    );
  });

  it('rejects public origins that are not allowlisted', () => {
    assert.equal(isAllowedCorsOrigin('https://evil.example', { allowedOrigins }), false);
  });
});

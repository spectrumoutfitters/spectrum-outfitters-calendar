import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShortLinkFullUrl,
  isValidAbsoluteUrl,
  normalizeSlug,
} from '../utils/shortLinkSlug.js';

describe('normalizeSlug', () => {
  it('lowercases, trims, and collapses invalid characters to dashes', () => {
    assert.equal(normalizeSlug('  Pay Me Now!!  '), 'pay-me-now');
    assert.equal(normalizeSlug('Invoice_#42'), 'invoice-42');
  });

  it('strips leading/trailing dashes and truncates to 50 chars', () => {
    assert.equal(normalizeSlug('---hello---'), 'hello');
    const long = `a${'b'.repeat(60)}`;
    assert.equal(normalizeSlug(long).length, 50);
  });

  it('returns empty string for empty / punctuation-only input', () => {
    assert.equal(normalizeSlug(''), '');
    assert.equal(normalizeSlug(null), '');
    assert.equal(normalizeSlug('!!!'), '');
  });
});

describe('isValidAbsoluteUrl', () => {
  it('accepts absolute http(s) URLs', () => {
    assert.equal(isValidAbsoluteUrl('https://pay.example.com/pay/tok'), true);
    assert.equal(isValidAbsoluteUrl('http://localhost:5173/pay/x'), true);
  });

  it('rejects relative paths and non-URLs', () => {
    assert.equal(isValidAbsoluteUrl('/pay/tok'), false);
    assert.equal(isValidAbsoluteUrl('not a url'), false);
    assert.equal(isValidAbsoluteUrl(''), false);
  });
});

describe('buildShortLinkFullUrl', () => {
  it('joins base + /secure/:slug and strips trailing slashes on base', () => {
    assert.equal(
      buildShortLinkFullUrl('https://securepay.example.com/', 'abc'),
      'https://securepay.example.com/secure/abc'
    );
  });

  it('returns undefined when base or slug is missing', () => {
    assert.equal(buildShortLinkFullUrl('', 'abc'), undefined);
    assert.equal(buildShortLinkFullUrl('https://securepay.example.com', ''), undefined);
  });
});

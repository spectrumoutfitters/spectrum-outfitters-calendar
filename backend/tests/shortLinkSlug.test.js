import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlug, isValidShortLinkTarget } from '../utils/shortLinkSlug.js';

describe('normalizeSlug', () => {
  it('lowercases, replaces non [a-z0-9-] runs, trims dashes, and caps at 50', () => {
    assert.equal(normalizeSlug('  Pay-Link  '), 'pay-link');
    assert.equal(normalizeSlug('Invoice #42 / Q2'), 'invoice-42-q2');
    assert.equal(normalizeSlug('---Hello---'), 'hello');
    assert.equal(normalizeSlug('!!!'), '');
    assert.equal(normalizeSlug(''), '');
    assert.equal(normalizeSlug(null), '');
    assert.equal(normalizeSlug('a'.repeat(80)).length, 50);
  });
});

describe('isValidShortLinkTarget', () => {
  it('requires a trimable http(s) or other absolute URL; rejects empty and relative', () => {
    assert.equal(isValidShortLinkTarget('https://securelink-prod.valorpaytech.com/pay/x'), true);
    assert.equal(isValidShortLinkTarget(' http://example.com/a '), true);
    assert.equal(isValidShortLinkTarget(''), false);
    assert.equal(isValidShortLinkTarget('   '), false);
    assert.equal(isValidShortLinkTarget(null), false);
    assert.equal(isValidShortLinkTarget('/secure/abc'), false);
    assert.equal(isValidShortLinkTarget('not a url'), false);
  });
});

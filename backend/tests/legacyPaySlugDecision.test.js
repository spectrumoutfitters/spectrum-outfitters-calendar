import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideLegacyPaySlugResponse } from '../utils/legacyPaySlugDecision.js';

describe('decideLegacyPaySlugResponse', () => {
  it('redirects when a short_links row has a target_url', () => {
    const decision = decideLegacyPaySlugResponse({
      target_url: 'https://pay.example/checkout/abc',
    });
    assert.deepEqual(decision, {
      type: 'redirect',
      targetUrl: 'https://pay.example/checkout/abc',
    });
  });

  it('falls through for CRM invoice tokens with no short_links row', () => {
    // crm_invoice_payment_links tokens are 32-hex; they are NOT inserted as short_links.slug
    const token = 'a'.repeat(32);
    assert.equal(token.length, 32);
    assert.deepEqual(decideLegacyPaySlugResponse(null), { type: 'next' });
    assert.deepEqual(decideLegacyPaySlugResponse(undefined), { type: 'next' });
    assert.deepEqual(decideLegacyPaySlugResponse({}), { type: 'next' });
    assert.deepEqual(decideLegacyPaySlugResponse({ target_url: '' }), { type: 'next' });
    assert.deepEqual(decideLegacyPaySlugResponse({ target_url: '   ' }), { type: 'next' });
  });

  it('trims target_url before redirecting', () => {
    const decision = decideLegacyPaySlugResponse({ target_url: '  https://x.test/y  ' });
    assert.deepEqual(decision, { type: 'redirect', targetUrl: 'https://x.test/y' });
  });
});

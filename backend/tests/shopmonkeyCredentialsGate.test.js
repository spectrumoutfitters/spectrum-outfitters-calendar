import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOPMONKEY_PLACEHOLDER_API_KEY,
  isShopmonkeyApiKeyConfigured,
} from '../utils/shopmonkeyCredentialsGate.js';

describe('isShopmonkeyApiKeyConfigured', () => {
  it('rejects missing, empty, and whitespace-only keys', () => {
    assert.equal(isShopmonkeyApiKeyConfigured(undefined), false);
    assert.equal(isShopmonkeyApiKeyConfigured(null), false);
    assert.equal(isShopmonkeyApiKeyConfigured(''), false);
    assert.equal(isShopmonkeyApiKeyConfigured('   '), false);
  });

  it('rejects the exact .env placeholder', () => {
    assert.equal(isShopmonkeyApiKeyConfigured(SHOPMONKEY_PLACEHOLDER_API_KEY), false);
    assert.equal(isShopmonkeyApiKeyConfigured('your_shopmonkey_api_key_here'), false);
  });

  it('accepts a real key', () => {
    assert.equal(isShopmonkeyApiKeyConfigured('sm_live_abc123'), true);
  });

  it('treats a placeholder with trailing spaces as configured (trim is empty-only)', () => {
    assert.equal(isShopmonkeyApiKeyConfigured('your_shopmonkey_api_key_here '), true);
  });
});

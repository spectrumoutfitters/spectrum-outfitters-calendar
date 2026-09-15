import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOPMONKEY_QUOTE_ORIGIN,
  DEFAULT_SHOPMONKEY_QUOTE_EMBED_SRC,
  shopMonkeyQuoteEmbedSrc,
  shouldAcceptShopMonkeyQuoteMessage,
} from '../src/utils/shopMonkeyQuoteMessage.js';

describe('shopMonkeyQuoteEmbedSrc', () => {
  it('uses a trimmed env override, otherwise the default embed URL', () => {
    assert.equal(
      shopMonkeyQuoteEmbedSrc('  https://app.shopmonkey.cloud/public/quote-request/custom  '),
      'https://app.shopmonkey.cloud/public/quote-request/custom'
    );
    assert.equal(shopMonkeyQuoteEmbedSrc(''), DEFAULT_SHOPMONKEY_QUOTE_EMBED_SRC);
    assert.equal(shopMonkeyQuoteEmbedSrc('   '), DEFAULT_SHOPMONKEY_QUOTE_EMBED_SRC);
    assert.equal(shopMonkeyQuoteEmbedSrc(undefined), DEFAULT_SHOPMONKEY_QUOTE_EMBED_SRC);
    assert.equal(shopMonkeyQuoteEmbedSrc(null), DEFAULT_SHOPMONKEY_QUOTE_EMBED_SRC);
  });
});

describe('shouldAcceptShopMonkeyQuoteMessage', () => {
  const payload = { source: 'sm_wrf', dataLayer: { event: 'quote' } };

  it('accepts sm_wrf dataLayer messages from the ShopMonkey origin', () => {
    assert.equal(
      shouldAcceptShopMonkeyQuoteMessage({
        origin: SHOPMONKEY_QUOTE_ORIGIN,
        data: payload,
      }),
      true
    );
  });

  it('rejects other origins even with a well-formed payload', () => {
    assert.equal(
      shouldAcceptShopMonkeyQuoteMessage({
        origin: 'https://evil.example',
        data: payload,
      }),
      false
    );
    assert.equal(
      shouldAcceptShopMonkeyQuoteMessage({
        origin: 'https://app.shopmonkey.cloud.evil',
        data: payload,
      }),
      false
    );
  });

  it('rejects missing source / dataLayer / event', () => {
    assert.equal(
      shouldAcceptShopMonkeyQuoteMessage({
        origin: SHOPMONKEY_QUOTE_ORIGIN,
        data: { source: 'sm_wrf' },
      }),
      false
    );
    assert.equal(
      shouldAcceptShopMonkeyQuoteMessage({
        origin: SHOPMONKEY_QUOTE_ORIGIN,
        data: { source: 'other', dataLayer: payload.dataLayer },
      }),
      false
    );
    assert.equal(shouldAcceptShopMonkeyQuoteMessage(null), false);
    assert.equal(
      shouldAcceptShopMonkeyQuoteMessage({ origin: SHOPMONKEY_QUOTE_ORIGIN, data: null }),
      false
    );
  });
});

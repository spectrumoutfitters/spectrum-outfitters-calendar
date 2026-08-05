import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  customerBaseUrl,
  customerPathPrefix,
  buildAffiliateCustomerUrls,
} from '../utils/affiliateCustomerUrls.js';

describe('customerBaseUrl', () => {
  it('prefers CUSTOMER_AFFILIATE_BASE_URL and strips trailing slashes', () => {
    assert.equal(
      customerBaseUrl({
        CUSTOMER_AFFILIATE_BASE_URL: 'https://spectrumoutfitters.com/',
        FRONTEND_URL: 'https://app.example/',
      }),
      'https://spectrumoutfitters.com'
    );
  });

  it('falls back through public URL env vars', () => {
    assert.equal(
      customerBaseUrl({ CUSTOMER_PUBLIC_URL: 'https://public.example' }),
      'https://public.example'
    );
    assert.equal(
      customerBaseUrl({ PUBLIC_APP_URL: 'https://app.public/' }),
      'https://app.public'
    );
    assert.equal(customerBaseUrl({ FRONTEND_URL: 'https://spa.example' }), 'https://spa.example');
    assert.equal(customerBaseUrl({}), '');
  });
});

describe('customerPathPrefix', () => {
  it('normalizes missing slash and strips trailing slashes', () => {
    assert.equal(customerPathPrefix({ CUSTOMER_AFFILIATE_PATH_PREFIX: 'book/' }), '/book');
    assert.equal(customerPathPrefix({ CUSTOMER_AFFILIATE_PATH_PREFIX: '/quotes' }), '/quotes');
    assert.equal(customerPathPrefix({}), '');
  });
});

describe('buildAffiliateCustomerUrls', () => {
  it('builds path and full_url with prefix', () => {
    const urls = buildAffiliateCustomerUrls('abc123', {
      CUSTOMER_AFFILIATE_BASE_URL: 'https://spectrumoutfitters.com',
      CUSTOMER_AFFILIATE_PATH_PREFIX: 'c',
    });
    assert.deepEqual(urls, {
      path: '/c/affiliates/abc123',
      full_url: 'https://spectrumoutfitters.com/c/affiliates/abc123',
    });
  });

  it('omits full_url when no base is configured', () => {
    const urls = buildAffiliateCustomerUrls('tok', {});
    assert.equal(urls.path, '/affiliates/tok');
    assert.equal(urls.full_url, null);
  });

  it('collapses duplicate slashes in the path', () => {
    const urls = buildAffiliateCustomerUrls('x', {
      CUSTOMER_AFFILIATE_BASE_URL: 'https://example.com',
      CUSTOMER_AFFILIATE_PATH_PREFIX: '//nested//',
    });
    assert.equal(urls.path, '/nested/affiliates/x');
    assert.equal(urls.full_url, 'https://example.com/nested/affiliates/x');
  });
});

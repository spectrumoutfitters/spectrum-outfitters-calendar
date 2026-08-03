import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  baseAppUrl,
  buildInvoicePayUrl,
  buildSecureShortUrl,
  shortLinkBase,
} from '../utils/crmPaymentLinkUrls.js';

function req(headers = {}, protocol = 'https') {
  return { headers, protocol };
}

describe('baseAppUrl', () => {
  it('prefers PUBLIC_APP_URL over request host and strips trailing slashes', () => {
    const url = baseAppUrl(req({ host: 'internal.example' }), {
      PUBLIC_APP_URL: 'https://app.example.com/',
      FRONTEND_URL: 'https://frontend.example.com',
    });
    assert.equal(url, 'https://app.example.com');
  });

  it('falls back to FRONTEND_URL when PUBLIC_APP_URL is unset', () => {
    const url = baseAppUrl(req({ host: 'internal.example' }), {
      FRONTEND_URL: 'https://frontend.example.com///',
    });
    assert.equal(url, 'https://frontend.example.com');
  });

  it('treats whitespace-only PUBLIC_APP_URL as unset origin (falls through to request host)', () => {
    // Mirrors prior route: truthy-but-blank PUBLIC_APP_URL skips FRONTEND_URL after trim.
    const url = baseAppUrl(req({ host: 'internal.example' }), {
      PUBLIC_APP_URL: '  ',
      FRONTEND_URL: 'https://frontend.example.com',
    });
    assert.equal(url, 'https://internal.example');
  });

  it('uses first x-forwarded proto/host when env origins are unset', () => {
    const url = baseAppUrl(
      req({
        'x-forwarded-proto': 'https, http',
        'x-forwarded-host': 'pay.example.com, localhost',
      }),
      {}
    );
    assert.equal(url, 'https://pay.example.com');
  });

  it('falls back to req.protocol + host when forwarded headers are missing', () => {
    const url = baseAppUrl(req({ host: 'shop.local:5000' }, 'http'), {});
    assert.equal(url, 'http://shop.local:5000');
  });

  it('returns empty string when no env origin and no host are available', () => {
    assert.equal(baseAppUrl(req({}, 'https'), {}), '');
  });
});

describe('shortLinkBase', () => {
  it('prefers SHORT_LINK_BASE_URL', () => {
    const url = shortLinkBase(req({ host: 'app.example.com' }), {
      SHORT_LINK_BASE_URL: 'https://securepay.example.com/',
      PUBLIC_APP_URL: 'https://app.example.com',
    });
    assert.equal(url, 'https://securepay.example.com');
  });

  it('falls back to baseAppUrl when SHORT_LINK_BASE_URL is unset', () => {
    const url = shortLinkBase(req({ host: 'app.example.com' }), {
      PUBLIC_APP_URL: 'https://app.example.com',
    });
    assert.equal(url, 'https://app.example.com');
  });
});

describe('buildInvoicePayUrl / buildSecureShortUrl', () => {
  it('builds absolute pay URL when app origin is present', () => {
    assert.equal(
      buildInvoicePayUrl('https://app.example.com/', 'abc123'),
      'https://app.example.com/pay/abc123'
    );
  });

  it('returns relative pay path when app origin is missing', () => {
    assert.equal(buildInvoicePayUrl('', 'tok'), '/pay/tok');
  });

  it('builds /secure short URL only when base and slug exist', () => {
    assert.equal(
      buildSecureShortUrl('https://securepay.example.com/', 'Ab12'),
      'https://securepay.example.com/secure/Ab12'
    );
    assert.equal(buildSecureShortUrl('', 'Ab12'), null);
    assert.equal(buildSecureShortUrl('https://securepay.example.com', ''), null);
  });
});

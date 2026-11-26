import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Runs the Stripe Checkout return URLs from checkout/route.ts. Stripe replaces
 * the literal {CHECKOUT_SESSION_ID} after payment. Encoding that placeholder,
 * or sending the buyer to an Origin header, drops the session id or leaves
 * the success page. The route is not imported (it starts a Checkout Session).
 */
const routePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/app/api/raffle/checkout/route.ts',
);
const source = fs.readFileSync(routePath, 'utf8');

const START = 'const origin = getRaffleSiteOrigin() || new URL(request.url).origin;';
const END = 'const cancelUrl = `${origin}/e/${encodeURIComponent(slug)}/my-entry?token=${encodeURIComponent(token)}&buy=cancel`;';

function sliceReturnUrls() {
  const start = source.indexOf(START);
  assert.notEqual(start, -1, 'checkout route is missing the return origin');
  assert.equal(source.indexOf(START, start + START.length), -1, 'checkout route defines the return origin twice');
  const end = source.indexOf(END, start);
  assert.notEqual(end, -1, 'checkout route is missing the cancel URL');
  assert.equal(source.indexOf(END, end + END.length), -1, 'checkout route defines the cancel URL twice');
  const slice = source.slice(start, end + END.length);
  assert.equal(slice.includes('{CHECKOUT_SESSION_ID}'), true);
  assert.equal(slice.includes('%7BCHECKOUT_SESSION_ID%7D'), false);
  assert.equal(slice.split('encodeURIComponent(slug)').length - 1, 2);
  assert.equal(slice.split('encodeURIComponent(token)').length - 1, 2);
  return slice;
}

let siteOrigin = 'https://raffle.example';

const checkoutReturnUrls = new Function(
  'getRaffleSiteOrigin',
  "'use strict';\nfunction checkoutReturnUrls(slug, token, request) {\n"
    + sliceReturnUrls()
    + '\nreturn { origin, successUrl, cancelUrl };\n}\nreturn checkoutReturnUrls;',
)(() => siteOrigin);

function requestFrom(url) {
  return {
    url,
    headers: {
      get(name) {
        return String(name).toLowerCase() === 'origin' ? 'https://evil.example' : null;
      },
    },
  };
}

describe('checkout return URLs', () => {
  it('keeps the Stripe session placeholder literal and encodes slug and token', () => {
    siteOrigin = 'https://raffle.example';
    const plain = checkoutReturnUrls('spring', 'tok_abc', requestFrom('https://evil.example/api/raffle/checkout'));
    assert.equal(
      plain.successUrl,
      'https://raffle.example/e/spring/buy/success?token=tok_abc&session_id={CHECKOUT_SESSION_ID}',
    );
    assert.equal(
      plain.cancelUrl,
      'https://raffle.example/e/spring/my-entry?token=tok_abc&buy=cancel',
    );
    assert.equal(plain.successUrl.includes('%7BCHECKOUT_SESSION_ID%7D'), false);

    const encoded = checkoutReturnUrls('a/b c', 'tok&en=1', requestFrom('https://raffle.example/api/raffle/checkout'));
    assert.equal(
      encoded.successUrl,
      'https://raffle.example/e/a%2Fb%20c/buy/success?token=tok%26en%3D1&session_id={CHECKOUT_SESSION_ID}',
    );
    assert.equal(
      encoded.cancelUrl,
      'https://raffle.example/e/a%2Fb%20c/my-entry?token=tok%26en%3D1&buy=cancel',
    );
  });

  it('uses the request URL origin when the site origin is unset', () => {
    siteOrigin = '';
    const local = checkoutReturnUrls(
      'spring',
      'tok_abc',
      requestFrom('http://127.0.0.1:3000/api/raffle/checkout?x=1'),
    );
    assert.equal(local.origin, 'http://127.0.0.1:3000');
    assert.equal(
      local.successUrl,
      'http://127.0.0.1:3000/e/spring/buy/success?token=tok_abc&session_id={CHECKOUT_SESSION_ID}',
    );
    assert.equal(
      local.cancelUrl,
      'http://127.0.0.1:3000/e/spring/my-entry?token=tok_abc&buy=cancel',
    );
    assert.equal(local.successUrl.includes('evil.example'), false);
    assert.equal(local.successUrl.includes('/api/raffle/checkout'), false);
  });
});

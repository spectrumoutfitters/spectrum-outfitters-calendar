import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import { signPaidPurchasePayload } from '../src/lib/paidPurchaseSign.ts';

const SECRET_KEY = 'RAFFLE_PAID_PURCHASE_SECRET';
const originalSecret = process.env[SECRET_KEY];

function hmac(secret, payloadString) {
  return crypto.createHmac('sha256', secret).update(payloadString, 'utf8').digest('hex');
}

function missingSecret(err) {
  return err instanceof Error && err.message === 'missing_paid_purchase_secret';
}

afterEach(() => {
  if (originalSecret === undefined) delete process.env[SECRET_KEY];
  else process.env[SECRET_KEY] = originalSecret;
});

describe('signPaidPurchasePayload', () => {
  it('refuses to sign when the shared secret is missing or blank', () => {
    delete process.env[SECRET_KEY];
    assert.throws(() => signPaidPurchasePayload('{}'), missingSecret);

    process.env[SECRET_KEY] = '';
    assert.throws(() => signPaidPurchasePayload('{}'), missingSecret);

    process.env[SECRET_KEY] = '   ';
    assert.throws(() => signPaidPurchasePayload('{}'), missingSecret);
  });

  it('signs the exact payload string with the trimmed secret', () => {
    const payloadString = JSON.stringify({
      slug: 'grand-opening',
      token: 'entry-token-1',
      stripeSessionId: 'cs_test_session',
      totalPaidTickets: 4,
      ticketSplit: { 'grand-prize': 3, 'door-prize': 1 },
      paidAt: '2026-06-15T12:00:00.000Z',
      amountTotal: 2000,
      currency: 'usd',
      clientIp: 'stripe-webhook',
      userAgent: 'stripe-webhook',
    });
    process.env[SECRET_KEY] = '  raffle-test-secret  ';

    const signed = signPaidPurchasePayload(payloadString);

    assert.equal(signed.payloadString, payloadString);
    assert.equal(signed.signature, hmac('raffle-test-secret', payloadString));
    assert.match(signed.signature, /^[0-9a-f]{64}$/);
    assert.notEqual(signed.signature, hmac('  raffle-test-secret  ', payloadString));
  });

  it('keeps surrounding payload whitespace and changes the signature when the bytes change', () => {
    process.env[SECRET_KEY] = 'raffle-test-secret';
    const padded = ' {"slug":"grand-opening"} ';
    const signed = signPaidPurchasePayload(padded);
    const other = signPaidPurchasePayload('{"slug":"other-event"}');

    assert.equal(signed.payloadString, padded);
    assert.equal(signed.signature, hmac('raffle-test-secret', padded));
    assert.notEqual(other.signature, signed.signature);
    assert.equal(other.payloadString, '{"slug":"other-event"}');
  });

  it('signs an empty payload string instead of dropping it', () => {
    process.env[SECRET_KEY] = 'raffle-test-secret';
    const signed = signPaidPurchasePayload('');

    assert.equal(signed.payloadString, '');
    assert.equal(signed.signature, hmac('raffle-test-secret', ''));
  });
});

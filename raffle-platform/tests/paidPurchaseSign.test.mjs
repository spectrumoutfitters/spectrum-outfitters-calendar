import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { signPaidPurchasePayload } from '../src/lib/paidPurchaseSign.ts';

describe('signPaidPurchasePayload', () => {
  const original = process.env.RAFFLE_PAID_PURCHASE_SECRET;

  before(() => {
    process.env.RAFFLE_PAID_PURCHASE_SECRET = ' unit-test-secret ';
  });

  after(() => {
    if (original === undefined) delete process.env.RAFFLE_PAID_PURCHASE_SECRET;
    else process.env.RAFFLE_PAID_PURCHASE_SECRET = original;
  });

  it('returns an HMAC-SHA256 hex digest of the payload with the trimmed secret', () => {
    const payload = '{"entryId":"e1","tickets":3}';
    const { signature, payloadString } = signPaidPurchasePayload(payload);
    const expected = createHmac('sha256', 'unit-test-secret')
      .update(payload, 'utf8')
      .digest('hex');
    assert.equal(payloadString, payload);
    assert.equal(signature, expected);
  });

  it('throws when the paid-purchase secret is missing', () => {
    delete process.env.RAFFLE_PAID_PURCHASE_SECRET;
    assert.throws(() => signPaidPurchasePayload('x'), /missing_paid_purchase_secret/);
    process.env.RAFFLE_PAID_PURCHASE_SECRET = ' unit-test-secret ';
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOpenStripePaymentIntentStatus,
  selectCandidateOpenPaymentRows,
  shouldReuseRetrievedPaymentIntent,
  stripePaymentIntentIdempotencyKey,
} from '../utils/stripePaymentIntentReuse.js';

describe('isOpenStripePaymentIntentStatus', () => {
  it('treats requires_* / processing / created as open', () => {
    for (const status of [
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
      'requires_capture',
      'created',
      'REQUIRES_PAYMENT_METHOD',
    ]) {
      assert.equal(isOpenStripePaymentIntentStatus(status), true, status);
    }
  });

  it('treats terminal statuses as closed', () => {
    for (const status of ['succeeded', 'paid', 'canceled', 'cancelled', 'failed', '', null, undefined]) {
      assert.equal(isOpenStripePaymentIntentStatus(status), false, String(status));
    }
  });
});

describe('stripePaymentIntentIdempotencyKey', () => {
  it('is stable for the same invoice and amount due', () => {
    assert.equal(
      stripePaymentIntentIdempotencyKey(42, 18500),
      stripePaymentIntentIdempotencyKey(42, 18500)
    );
    assert.equal(stripePaymentIntentIdempotencyKey(42, 18500), 'crm-invoice-42-due-18500');
  });

  it('changes when amount due changes so a new chargeable intent can be created', () => {
    assert.notEqual(
      stripePaymentIntentIdempotencyKey(42, 18500),
      stripePaymentIntentIdempotencyKey(42, 10000)
    );
  });

  it('rejects invalid inputs', () => {
    assert.throws(() => stripePaymentIntentIdempotencyKey(0, 100));
    assert.throws(() => stripePaymentIntentIdempotencyKey(1, 0));
  });
});

describe('selectCandidateOpenPaymentRows / shouldReuseRetrievedPaymentIntent', () => {
  it('keeps open rows (including stale amounts) and skips terminal ones', () => {
    const rows = [
      { id: 1, provider_payment_intent_id: 'pi_new', amount_cents: 5000, status: 'requires_payment_method' },
      { id: 2, provider_payment_intent_id: 'pi_stale', amount_cents: 8000, status: 'created' },
      { id: 3, provider_payment_intent_id: 'pi_paid', amount_cents: 5000, status: 'succeeded' },
      { id: 4, provider_payment_intent_id: null, amount_cents: 5000, status: 'created' },
    ];
    const candidates = selectCandidateOpenPaymentRows(rows, 5000);
    assert.deepEqual(
      candidates.map((r) => r.id),
      [1, 2]
    );
  });

  it('reuses only open Stripe intents whose amount still matches amount due', () => {
    assert.equal(
      shouldReuseRetrievedPaymentIntent(
        { amount: 5000, status: 'requires_payment_method', client_secret: 'cs_test' },
        5000
      ),
      true
    );
    assert.equal(
      shouldReuseRetrievedPaymentIntent(
        { amount: 8000, status: 'requires_payment_method', client_secret: 'cs_test' },
        5000
      ),
      false
    );
    assert.equal(
      shouldReuseRetrievedPaymentIntent(
        { amount: 5000, status: 'succeeded', client_secret: 'cs_test' },
        5000
      ),
      false
    );
    assert.equal(
      shouldReuseRetrievedPaymentIntent(
        { amount: 5000, status: 'requires_payment_method', client_secret: null },
        5000
      ),
      false
    );
  });
});

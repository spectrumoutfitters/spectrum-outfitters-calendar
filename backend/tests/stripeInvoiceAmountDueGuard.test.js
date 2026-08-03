import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOverchargeRefundCents,
  isOpenStripePaymentIntentStatus,
  selectOpenPaymentRowsToCancel,
} from '../utils/stripeInvoiceAmountDueGuard.js';

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
    for (const status of ['succeeded', 'paid', 'canceled', 'cancelled', 'failed', 'refunded', '', null, undefined]) {
      assert.equal(isOpenStripePaymentIntentStatus(status), false, String(status));
    }
  });
});

describe('selectOpenPaymentRowsToCancel', () => {
  it('keeps only open rows with a PaymentIntent id', () => {
    const rows = [
      { id: 1, provider_payment_intent_id: 'pi_open', status: 'requires_payment_method' },
      { id: 2, provider_payment_intent_id: 'pi_created', status: 'created' },
      { id: 3, provider_payment_intent_id: 'pi_paid', status: 'succeeded' },
      { id: 4, provider_payment_intent_id: null, status: 'created' },
      { id: 5, provider_payment_intent_id: 'pi_failed', status: 'failed' },
    ];
    assert.deepEqual(
      selectOpenPaymentRowsToCancel(rows).map((r) => r.id),
      [1, 2]
    );
  });
});

describe('computeOverchargeRefundCents', () => {
  it('refunds nothing when charge equals remaining amount due', () => {
    // Invoice $100, $0 already paid, charge $100
    assert.deepEqual(computeOverchargeRefundCents(10000, 0, 10000), {
      keepCents: 10000,
      refundCents: 0,
    });
  });

  it('refunds excess when manual payment reduced amount due before card confirmation', () => {
    // Invoice $100, $60 cash paid, stale $100 PaymentIntent succeeds
    assert.deepEqual(computeOverchargeRefundCents(10000, 6000, 10000), {
      keepCents: 4000,
      refundCents: 6000,
    });
  });

  it('fully refunds when invoice is already paid', () => {
    assert.deepEqual(computeOverchargeRefundCents(10000, 10000, 10000), {
      keepCents: 0,
      refundCents: 10000,
    });
  });

  it('fully refunds when invoice total was edited down to zero/paid', () => {
    assert.deepEqual(computeOverchargeRefundCents(0, 0, 5000), {
      keepCents: 0,
      refundCents: 5000,
    });
  });

  it('keeps a partial charge that still fits remaining balance', () => {
    assert.deepEqual(computeOverchargeRefundCents(10000, 7000, 2500), {
      keepCents: 2500,
      refundCents: 0,
    });
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cents,
  paymentAmountCentsFromStripeIntent,
  shouldInsertMissingPaymentRow,
} from '../utils/stripeInvoicePaymentLedger.js';

describe('stripeInvoicePaymentLedger', () => {
  it('prefers amount_received over amount', () => {
    assert.equal(paymentAmountCentsFromStripeIntent({ amount_received: 4010, amount: 5000 }), 4010);
    assert.equal(paymentAmountCentsFromStripeIntent({ amount: 2500 }), 2500);
    assert.equal(paymentAmountCentsFromStripeIntent({}), null);
  });

  it('inserts a ledger row only when UPDATE matched nothing on success', () => {
    assert.equal(shouldInsertMissingPaymentRow({ updateChanges: 0, status: 'succeeded' }), true);
    assert.equal(shouldInsertMissingPaymentRow({ updateChanges: 0, status: 'paid' }), true);
    assert.equal(shouldInsertMissingPaymentRow({ updateChanges: 1, status: 'succeeded' }), false);
    assert.equal(shouldInsertMissingPaymentRow({ updateChanges: 0, status: 'requires_payment_method' }), false);
    assert.equal(shouldInsertMissingPaymentRow({ updateChanges: 0, status: 'failed' }), false);
  });

  it('rounds cents helpers', () => {
    assert.equal(cents(10.4), 10);
    assert.equal(cents('12.6'), 13);
    assert.equal(cents('nope'), null);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInvoiceAlreadyPaid,
  shouldStartPaymentIntent,
} from '../src/utils/publicInvoicePayGate.js';

describe('shouldStartPaymentIntent', () => {
  it('does not start when due is missing or not positive', () => {
    assert.equal(shouldStartPaymentIntent(null), false);
    assert.equal(shouldStartPaymentIntent(undefined), false);
    assert.equal(shouldStartPaymentIntent(0), false);
    assert.equal(shouldStartPaymentIntent(-1), false);
    assert.equal(shouldStartPaymentIntent('0'), false);
  });

  it('starts when due is a positive number or numeric string', () => {
    assert.equal(shouldStartPaymentIntent(1), true);
    assert.equal(shouldStartPaymentIntent(2500), true);
    assert.equal(shouldStartPaymentIntent('2500'), true);
  });

  it('starts for non-numeric due because Number(...) <= 0 is false for NaN', () => {
    assert.equal(shouldStartPaymentIntent('abc'), true);
    assert.equal(shouldStartPaymentIntent(NaN), true);
  });
});

describe('isInvoiceAlreadyPaid', () => {
  it('treats falsy due as paid via amountDue || 0', () => {
    assert.equal(isInvoiceAlreadyPaid(null), true);
    assert.equal(isInvoiceAlreadyPaid(undefined), true);
    assert.equal(isInvoiceAlreadyPaid(''), true);
    assert.equal(isInvoiceAlreadyPaid(NaN), true);
    assert.equal(isInvoiceAlreadyPaid(0), true);
  });

  it('does not treat a truthy non-numeric string as paid', () => {
    assert.equal(isInvoiceAlreadyPaid('abc'), false);
  });

  it('is not paid when due is positive', () => {
    assert.equal(isInvoiceAlreadyPaid(1), false);
    assert.equal(isInvoiceAlreadyPaid('2500'), false);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideManualPaymentRecord } from '../utils/manualInvoicePayment.js';

describe('decideManualPaymentRecord', () => {
  it('accepts a partial payment within balance due', () => {
    const d = decideManualPaymentRecord({
      invoiceTotalCents: 10000,
      alreadyPaidCents: 2500,
      amountCents: 3000,
    });
    assert.equal(d.ok, true);
    assert.equal(d.amountCents, 3000);
    assert.equal(d.amountDueCents, 7500);
    assert.equal(d.paymentStatus, 'partial');
    assert.equal(d.newPaidCents, 5500);
  });

  it('accepts a payment that exactly settles the invoice', () => {
    const d = decideManualPaymentRecord({
      invoiceTotalCents: 10000,
      alreadyPaidCents: 4000,
      amountCents: 6000,
    });
    assert.equal(d.ok, true);
    assert.equal(d.paymentStatus, 'paid');
    assert.equal(d.newPaidCents, 10000);
  });

  it('rejects overpayment beyond remaining balance', () => {
    const d = decideManualPaymentRecord({
      invoiceTotalCents: 10000,
      alreadyPaidCents: 0,
      amountCents: 10001,
    });
    assert.equal(d.ok, false);
    assert.equal(d.code, 'exceeds_due');
    assert.equal(d.amountDueCents, 10000);
  });

  it('rejects a second full payment after the invoice is already settled', () => {
    const d = decideManualPaymentRecord({
      invoiceTotalCents: 10000,
      alreadyPaidCents: 10000,
      amountCents: 10000,
    });
    assert.equal(d.ok, false);
    assert.equal(d.code, 'already_paid');
  });

  it('rejects missing invoices before any insert', () => {
    const d = decideManualPaymentRecord({
      invoiceTotalCents: null,
      alreadyPaidCents: 0,
      amountCents: 500,
    });
    assert.equal(d.ok, false);
    assert.equal(d.code, 'not_found');
  });

  it('rejects non-positive amounts', () => {
    const d = decideManualPaymentRecord({
      invoiceTotalCents: 10000,
      alreadyPaidCents: 0,
      amountCents: 0,
    });
    assert.equal(d.ok, false);
    assert.equal(d.code, 'invalid_amount');
  });
});

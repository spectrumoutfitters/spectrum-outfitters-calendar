import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countsTowardInvoicePaid,
  formatCents,
  invoiceAmountDueCents,
  sumSucceededPaymentCents,
} from '../src/utils/invoicePaymentMath.js';

describe('countsTowardInvoicePaid', () => {
  it('accepts succeeded and paid (case-insensitive)', () => {
    assert.equal(countsTowardInvoicePaid('succeeded'), true);
    assert.equal(countsTowardInvoicePaid('PAID'), true);
    assert.equal(countsTowardInvoicePaid('Paid'), true);
  });

  it('rejects open, failed, and empty statuses', () => {
    for (const status of [
      'requires_payment_method',
      'processing',
      'created',
      'failed',
      'canceled',
      'refunded',
      '',
      null,
      undefined,
    ]) {
      assert.equal(countsTowardInvoicePaid(status), false, String(status));
    }
  });
});

describe('sumSucceededPaymentCents', () => {
  it('sums only succeeded/paid finite amounts', () => {
    const sum = sumSucceededPaymentCents([
      { status: 'succeeded', amount_cents: 1000 },
      { status: 'paid', amount_cents: 250 },
      { status: 'requires_payment_method', amount_cents: 9999 },
      { status: 'failed', amount_cents: 500 },
      { status: 'succeeded', amount_cents: 'not-a-number' },
      { status: 'succeeded', amount_cents: null },
    ]);
    assert.equal(sum, 1250);
  });

  it('treats missing payments list as zero', () => {
    assert.equal(sumSucceededPaymentCents(undefined), 0);
    assert.equal(sumSucceededPaymentCents(null), 0);
    assert.equal(sumSucceededPaymentCents([]), 0);
  });
});

describe('invoiceAmountDueCents', () => {
  it('returns remaining balance and clamps overpayment to zero', () => {
    assert.equal(invoiceAmountDueCents(5000, 1200), 3800);
    assert.equal(invoiceAmountDueCents(5000, 5000), 0);
    assert.equal(invoiceAmountDueCents(5000, 6000), 0);
  });

  it('returns null when invoice total is undefined/non-finite (Number coercion)', () => {
    // Matches prior InvoiceDetail behavior: Number(undefined)/NaN → null due.
    assert.equal(invoiceAmountDueCents(undefined, 0), null);
    assert.equal(invoiceAmountDueCents('x', 0), null);
    assert.equal(invoiceAmountDueCents(Number.NaN, 0), null);
    // Number(null) === 0, so a null total is treated as $0 due, not "unknown".
    assert.equal(invoiceAmountDueCents(null, 0), 0);
  });

  it('treats non-finite paid as zero (regression: bad ledger row must not blank due)', () => {
    assert.equal(invoiceAmountDueCents(2500, undefined), 2500);
    assert.equal(invoiceAmountDueCents(2500, Number.NaN), 2500);
  });
});

describe('formatCents', () => {
  it('formats dollars with two decimals', () => {
    assert.equal(formatCents(0), '$0.00');
    assert.equal(formatCents(105), '$1.05');
    assert.equal(formatCents(123456), '$1234.56');
  });

  it('returns an em dash for non-finite values (Number coercion)', () => {
    assert.equal(formatCents(undefined), '—');
    assert.equal(formatCents(Number.NaN), '—');
    // Number(null) === 0 — keep display behavior stable with prior pages.
    assert.equal(formatCents(null), '$0.00');
  });
});

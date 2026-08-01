import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketInvoiceLineCents,
  invoiceTotalCents,
  normalizeLineType,
  paymentStatusFromPaid,
  toInt
} from '../utils/crmInvoiceLineMath.js';

describe('normalizeLineType', () => {
  it('maps labor / fee / tax / part prefixes', () => {
    assert.equal(normalizeLineType('Labor'), 'labor');
    assert.equal(normalizeLineType('lab-install'), 'labor');
    assert.equal(normalizeLineType('FEE'), 'fee');
    assert.equal(normalizeLineType('misc'), 'fee');
    assert.equal(normalizeLineType('tax_state'), 'fee');
    assert.equal(normalizeLineType('Part'), 'part');
    assert.equal(normalizeLineType('parts'), 'part');
  });

  it('defaults blank to part and keeps unknown labels', () => {
    assert.equal(normalizeLineType(''), 'part');
    assert.equal(normalizeLineType(null), 'part');
    assert.equal(normalizeLineType('discount'), 'discount');
  });
});

describe('bucketInvoiceLineCents', () => {
  it('splits cents into parts, labor, and fees', () => {
    const buckets = bucketInvoiceLineCents([
      { line_type: 'part', total_cents: 10000 },
      { line_type: 'labor', total_cents: 5000 },
      { line_type: 'fee', total_cents: 250 },
      { line_type: 'tax', total_cents: 825 },
      { line_type: 'unknown', total_cents: 100 }
    ]);
    assert.deepEqual(buckets, { parts: 10100, labor: 5000, fees: 1075 });
  });

  it('treats non-finite cents as zero', () => {
    assert.deepEqual(
      bucketInvoiceLineCents([{ line_type: 'labor', total_cents: 'nope' }]),
      { parts: 0, labor: 0, fees: 0 }
    );
  });
});

describe('invoiceTotalCents + paymentStatusFromPaid', () => {
  it('adds tax into invoice total', () => {
    assert.equal(invoiceTotalCents({ parts: 1000, labor: 500, fees: 100 }, 80), 1680);
  });

  it('derives unpaid / partial / paid status', () => {
    assert.equal(paymentStatusFromPaid(0, 1000), 'unpaid');
    assert.equal(paymentStatusFromPaid(250, 1000), 'partial');
    assert.equal(paymentStatusFromPaid(1000, 1000), 'paid');
    assert.equal(paymentStatusFromPaid(0, 0), 'unpaid');
  });

  it('toInt rounds finite numbers and rejects NaN', () => {
    assert.equal(toInt(1.6), 2);
    assert.equal(toInt('12.2'), 12);
    assert.equal(toInt('x'), null);
  });
});

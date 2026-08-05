import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNonNegativeInvoiceMoney,
  assertNonNegativeTaxCents,
} from '../utils/crmInvoiceMoneyGuards.js';

describe('crmInvoiceMoneyGuards', () => {
  it('allows non-negative line money', () => {
    assert.deepEqual(assertNonNegativeInvoiceMoney(0, 0), { ok: true });
    assert.deepEqual(assertNonNegativeInvoiceMoney(100, 250), { ok: true });
    assert.deepEqual(assertNonNegativeInvoiceMoney(null, 10), { ok: true });
  });

  it('rejects negative unit or total cents', () => {
    assert.equal(assertNonNegativeInvoiceMoney(-1, 10).ok, false);
    assert.equal(assertNonNegativeInvoiceMoney(10, -1).ok, false);
    assert.match(assertNonNegativeInvoiceMoney(-5, null).error, /unit_price_cents/);
    assert.match(assertNonNegativeInvoiceMoney(null, -5).error, /total_cents/);
  });

  it('rejects negative tax_cents that would undercharge invoices', () => {
    assert.deepEqual(assertNonNegativeTaxCents(0), { ok: true });
    assert.deepEqual(assertNonNegativeTaxCents(500), { ok: true });
    assert.deepEqual(assertNonNegativeTaxCents(null), { ok: true });
    assert.equal(assertNonNegativeTaxCents(-1).ok, false);
    assert.equal(assertNonNegativeTaxCents(-5000).ok, false);
    assert.match(assertNonNegativeTaxCents(-1).error, /tax_cents/);
  });
});

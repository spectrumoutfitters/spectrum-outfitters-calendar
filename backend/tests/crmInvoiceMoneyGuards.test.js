import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertNonNegativeInvoiceMoney } from '../utils/crmInvoiceMoneyGuards.js';

describe('assertNonNegativeInvoiceMoney', () => {
  it('allows zero and positive', () => {
    assert.equal(assertNonNegativeInvoiceMoney(0, 0).ok, true);
    assert.equal(assertNonNegativeInvoiceMoney(100, 250).ok, true);
    assert.equal(assertNonNegativeInvoiceMoney(null, null).ok, true);
  });

  it('rejects negative unit or total', () => {
    assert.match(assertNonNegativeInvoiceMoney(-1, 10).error, /unit_price/);
    assert.match(assertNonNegativeInvoiceMoney(10, -5).error, /total_cents/);
  });
});

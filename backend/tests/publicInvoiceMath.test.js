import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePublicInvoiceToken,
  isPublicInvoiceTokenMissing,
  invoiceCents,
  publicInvoiceAmountDueCents,
} from '../utils/publicInvoiceMath.js';

describe('parsePublicInvoiceToken / isPublicInvoiceTokenMissing', () => {
  it('trims; whitespace-only and missing tokens are rejected', () => {
    assert.equal(parsePublicInvoiceToken('  abc  '), 'abc');
    assert.equal(parsePublicInvoiceToken(undefined), '');
    assert.equal(parsePublicInvoiceToken(null), '');
    assert.equal(isPublicInvoiceTokenMissing('tok'), false);
    assert.equal(isPublicInvoiceTokenMissing(''), true);
    assert.equal(isPublicInvoiceTokenMissing(parsePublicInvoiceToken('   ')), true);
  });
});

describe('invoiceCents', () => {
  it('rounds finite numbers; Number(null) is 0; NaN/undefined become 0', () => {
    assert.equal(invoiceCents(1999), 1999);
    assert.equal(invoiceCents('12.4'), 12);
    assert.equal(invoiceCents('12.5'), 13);
    assert.equal(invoiceCents(null), 0);
    assert.equal(invoiceCents(undefined), 0);
    assert.equal(invoiceCents('nope'), 0);
    assert.equal(invoiceCents(Number.NaN), 0);
  });
});

describe('publicInvoiceAmountDueCents', () => {
  it('never goes negative; missing totals look fully paid', () => {
    assert.equal(publicInvoiceAmountDueCents(1000, 250), 750);
    assert.equal(publicInvoiceAmountDueCents(1000, 1000), 0);
    assert.equal(publicInvoiceAmountDueCents(1000, 1500), 0);
    assert.equal(publicInvoiceAmountDueCents(null, 0), 0);
    assert.equal(publicInvoiceAmountDueCents(undefined, 'nope'), 0);
  });
});

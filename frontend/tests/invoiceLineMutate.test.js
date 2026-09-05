import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  invoiceAddItemQuantity,
  invoiceAddItemUnitCents,
  isRejectedManualPaymentCents,
  manualPaymentCentsFromDollars,
  taxCentsFromDraft,
} from '../src/utils/invoiceLineMutate.js';

describe('taxCentsFromDraft', () => {
  it('treats empty / whitespace-only as 0 after Number(trim)', () => {
    assert.equal(taxCentsFromDraft(''), 0);
    assert.equal(taxCentsFromDraft('   '), 0);
  });

  it('Number + round; non-finite → 0; negatives kept', () => {
    assert.equal(taxCentsFromDraft('825'), 825);
    assert.equal(taxCentsFromDraft('8.25'), 8);
    assert.equal(taxCentsFromDraft('8.5'), 9);
    assert.equal(taxCentsFromDraft('0'), 0);
    assert.equal(taxCentsFromDraft('-5'), -5);
    assert.equal(taxCentsFromDraft('abc'), 0);
    assert.equal(taxCentsFromDraft('Infinity'), 0);
  });
});

describe('manualPaymentCentsFromDollars', () => {
  it('parseFloat then round*100; non-finite → null', () => {
    assert.equal(manualPaymentCentsFromDollars('12.34'), 1234);
    assert.equal(manualPaymentCentsFromDollars('  5  '), 500);
    assert.equal(manualPaymentCentsFromDollars('5abc'), 500);
    assert.equal(manualPaymentCentsFromDollars(''), null);
    assert.equal(manualPaymentCentsFromDollars('   '), null);
    assert.equal(manualPaymentCentsFromDollars('abc'), null);
    assert.equal(manualPaymentCentsFromDollars(null), null);
    assert.equal(manualPaymentCentsFromDollars(undefined), null);
  });

  it('keeps 0 and negatives for the caller to reject', () => {
    assert.equal(manualPaymentCentsFromDollars('0'), 0);
    assert.equal(manualPaymentCentsFromDollars('-1'), -100);
    assert.equal(manualPaymentCentsFromDollars('0.004'), 0);
  });
});

describe('isRejectedManualPaymentCents', () => {
  it('rejects null / 0 / negatives via !cents || cents <= 0', () => {
    assert.equal(isRejectedManualPaymentCents(null), true);
    assert.equal(isRejectedManualPaymentCents(0), true);
    assert.equal(isRejectedManualPaymentCents(-1), true);
    assert.equal(isRejectedManualPaymentCents(1), false);
    assert.equal(isRejectedManualPaymentCents(100), false);
  });
});

describe('invoiceAddItemQuantity', () => {
  it('keeps finite 0 / 1.5; empty string is 0; non-finite → 1', () => {
    assert.equal(invoiceAddItemQuantity('1'), 1);
    assert.equal(invoiceAddItemQuantity(2), 2);
    assert.equal(invoiceAddItemQuantity('1.5'), 1.5);
    assert.equal(invoiceAddItemQuantity('0'), 0);
    assert.equal(invoiceAddItemQuantity(''), 0);
    assert.equal(invoiceAddItemQuantity(null), 0);
    assert.equal(invoiceAddItemQuantity(undefined), 1);
    assert.equal(invoiceAddItemQuantity('abc'), 1);
    assert.equal(invoiceAddItemQuantity(Number.NaN), 1);
  });
});

describe('invoiceAddItemUnitCents', () => {
  it('finite dollars → rounded cents; empty → 0; non-finite → null', () => {
    assert.equal(invoiceAddItemUnitCents('9.99'), 999);
    assert.equal(invoiceAddItemUnitCents(1), 100);
    assert.equal(invoiceAddItemUnitCents(''), 0);
    assert.equal(invoiceAddItemUnitCents(null), 0);
    assert.equal(invoiceAddItemUnitCents(undefined), null);
    assert.equal(invoiceAddItemUnitCents('abc'), null);
  });
});

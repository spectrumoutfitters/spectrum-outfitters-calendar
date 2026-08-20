import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapPlaidTxnPersistFields,
  parsePlaidSyncItemId,
  parsePlaidBusinessExpenseQuery,
  plaidCategorizeUpdateValues,
} from '../utils/plaidTxnMap.js';

describe('mapPlaidTxnPersistFields', () => {
  it('prefers personal_finance_category.primary over the legacy category array', () => {
    const mapped = mapPlaidTxnPersistFields({
      merchant_name: 'Acme',
      personal_finance_category: { primary: 'FOOD_AND_DRINK' },
      category: ['Shops', 'Food'],
      pending: false,
      iso_currency_code: 'USD',
    });
    assert.equal(mapped.category, 'FOOD_AND_DRINK');
    assert.equal(mapped.merchant_name, 'Acme');
    assert.equal(mapped.pending, 0);
    assert.equal(mapped.iso_currency_code, 'USD');
  });

  it('falls through empty primary and joins a truthy category array (including [])', () => {
    assert.equal(
      mapPlaidTxnPersistFields({
        personal_finance_category: { primary: '' },
        category: ['Transfer', 'Payroll'],
      }).category,
      'Transfer > Payroll',
    );
    assert.equal(mapPlaidTxnPersistFields({ category: [] }).category, '');
    assert.equal(mapPlaidTxnPersistFields({ category: null }).category, null);
    assert.equal(mapPlaidTxnPersistFields({}).category, null);
  });

  it('stores pending via truthiness; empty merchant/currency coerce to null / USD', () => {
    assert.equal(mapPlaidTxnPersistFields({ pending: true }).pending, 1);
    assert.equal(mapPlaidTxnPersistFields({ pending: 'false' }).pending, 1);
    assert.equal(mapPlaidTxnPersistFields({ pending: 0 }).pending, 0);
    assert.equal(mapPlaidTxnPersistFields({ pending: '' }).pending, 0);
    assert.equal(mapPlaidTxnPersistFields({ merchant_name: '' }).merchant_name, null);
    assert.equal(mapPlaidTxnPersistFields({ iso_currency_code: '' }).iso_currency_code, 'USD');
  });
});

describe('parsePlaidSyncItemId', () => {
  it('treats falsy item_id as sync-all (null)', () => {
    assert.equal(parsePlaidSyncItemId('item-1'), 'item-1');
    assert.equal(parsePlaidSyncItemId(undefined), null);
    assert.equal(parsePlaidSyncItemId(''), null);
    assert.equal(parsePlaidSyncItemId(0), null);
  });
});

describe('parsePlaidBusinessExpenseQuery', () => {
  it('only exact string true filters as business=1; 1/false become 0; omit skips', () => {
    assert.deepEqual(parsePlaidBusinessExpenseQuery(undefined), { apply: false, value: undefined });
    assert.deepEqual(parsePlaidBusinessExpenseQuery('true'), { apply: true, value: 1 });
    assert.deepEqual(parsePlaidBusinessExpenseQuery('false'), { apply: true, value: 0 });
    assert.deepEqual(parsePlaidBusinessExpenseQuery('1'), { apply: true, value: 0 });
    assert.deepEqual(parsePlaidBusinessExpenseQuery('TRUE'), { apply: true, value: 0 });
  });
});

describe('plaidCategorizeUpdateValues', () => {
  it('any truthy flag (including string false) stores 1; empty category becomes null', () => {
    assert.deepEqual(plaidCategorizeUpdateValues({ is_business_expense: true, expense_category: 'parts' }), {
      is_business_expense: 1,
      expense_category: 'parts',
    });
    assert.deepEqual(plaidCategorizeUpdateValues({ is_business_expense: 'false', expense_category: '' }), {
      is_business_expense: 1,
      expense_category: null,
    });
    assert.deepEqual(plaidCategorizeUpdateValues({ is_business_expense: 0 }), {
      is_business_expense: 0,
      expense_category: null,
    });
  });
});

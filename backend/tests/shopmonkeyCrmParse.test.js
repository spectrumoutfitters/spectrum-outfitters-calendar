import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLineItemFields,
  formatCustomerName,
  normalizeOrdersArray,
  pickCustomerId,
  pickId,
  pickOrderId,
  pickVehicleId,
} from '../utils/shopmonkeyCrmParse.js';

describe('pickId / order id selectors', () => {
  it('returns first non-empty trimmed candidate', () => {
    assert.equal(pickId(null, '  ', ' abc ', 'def'), 'abc');
    assert.equal(pickId(undefined, null, ''), null);
  });

  it('reads nested customer / vehicle / order id shapes', () => {
    assert.equal(pickCustomerId({ customer: { customer_id: 'c-9' } }), 'c-9');
    assert.equal(pickVehicleId({ vehicleId: 'v-1' }), 'v-1');
    assert.equal(pickOrderId({ _id: 'o-22' }), 'o-22');
  });
});

describe('formatCustomerName', () => {
  it('prefers display-style name fields', () => {
    assert.equal(formatCustomerName({ displayName: 'Ada Lovelace' }), 'Ada Lovelace');
  });

  it('joins first/last when name fields are absent', () => {
    assert.equal(
      formatCustomerName({ first_name: 'Ada', lastName: 'Lovelace' }),
      'Ada Lovelace'
    );
  });

  it('returns null when no name parts exist', () => {
    assert.equal(formatCustomerName({ email: 'a@b.c' }), null);
  });
});

describe('extractLineItemFields', () => {
  it('maps alternate ShopMonkey field names and parses money/qty', () => {
    const row = extractLineItemFields({
      line_item_id: 'li-1',
      title: 'Oil filter',
      kind: 'part',
      sku: 'OF-100',
      qty: '2.5',
      unit_price_cents: '1299',
      amountCents: '2598',
    });
    assert.deepEqual(row, {
      shopmonkey_line_item_id: 'li-1',
      line_type: 'part',
      description: 'Oil filter',
      part_number: 'OF-100',
      quantity: 2.5,
      unit_price_cents: 1299,
      total_cents: 2598,
    });
  });

  it('nulls non-finite quantity / money values', () => {
    const row = extractLineItemFields({
      id: 'li-2',
      quantity: 'n/a',
      priceCents: 'oops',
      totalCents: '',
    });
    assert.equal(row.quantity, null);
    assert.equal(row.unit_price_cents, null);
    assert.equal(row.total_cents, null);
  });
});

describe('normalizeOrdersArray', () => {
  it('unwraps nested data.results.orders shapes', () => {
    const orders = [{ id: 1 }, { id: 2 }];
    assert.deepEqual(normalizeOrdersArray({ data: { results: { orders } } }), orders);
  });

  it('returns empty array for non-list payloads', () => {
    assert.deepEqual(normalizeOrdersArray({ ok: true }), []);
    assert.deepEqual(normalizeOrdersArray(null), []);
  });

  it('tolerates circular references without throwing', () => {
    const cyclic = { data: {} };
    cyclic.data.self = cyclic;
    assert.deepEqual(normalizeOrdersArray(cyclic), []);
  });
});

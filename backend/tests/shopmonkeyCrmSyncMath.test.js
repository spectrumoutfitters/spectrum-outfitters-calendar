import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickId,
  pickCustomerId,
  pickVehicleId,
  pickOrderId,
  formatCustomerName,
  extractLineItemFields,
  normalizeOrdersArray,
  pickInvoiceDate,
  computeShopmonkeyInvoiceMoney,
} from '../utils/shopmonkeyCrmSyncMath.js';

describe('pickId', () => {
  it('returns the first non-empty trimmed string and skips null/blank', () => {
    assert.equal(pickId(null, '  ', '  abc  ', 'def'), 'abc');
    assert.equal(pickId(0), '0');
    assert.equal(pickId(undefined, null, ''), null);
  });
});

describe('id pickers', () => {
  it('reads nested ShopMonkey customer / vehicle / order ids', () => {
    assert.equal(pickCustomerId({ customer: { customerId: ' c1 ' } }), 'c1');
    assert.equal(pickVehicleId({ vehicle_id: 'v9' }), 'v9');
    assert.equal(pickOrderId({ _id: 'ord-1' }), 'ord-1');
    assert.equal(pickCustomerId({}), null);
  });
});

describe('formatCustomerName', () => {
  it('prefers display/full name over first+last', () => {
    assert.equal(formatCustomerName({ displayName: 'Pat Lee', firstName: 'Pat' }), 'Pat Lee');
  });

  it('joins first + last when no display name exists', () => {
    assert.equal(formatCustomerName({ first_name: 'Pat', last_name: 'Lee' }), 'Pat Lee');
    assert.equal(formatCustomerName({ firstName: 'Pat' }), 'Pat');
    assert.equal(formatCustomerName({}), null);
  });
});

describe('extractLineItemFields', () => {
  it('maps qty/price aliases and drops non-finite numbers', () => {
    const row = extractLineItemFields({
      line_item_id: 'li-1',
      title: 'Oil Change',
      kind: 'labor',
      sku: 'OC-1',
      qty: '2.5',
      price_cents: '4500',
      amount_cents: '9000',
    });
    assert.deepEqual(row, {
      shopmonkey_line_item_id: 'li-1',
      line_type: 'labor',
      description: 'Oil Change',
      part_number: 'OC-1',
      quantity: 2.5,
      unit_price_cents: 4500,
      total_cents: 9000,
    });
  });

  it('keeps nulls for empty / non-numeric qty and cents', () => {
    const row = extractLineItemFields({
      name: 'Unknown',
      quantity: '',
      unitPriceCents: 'nope',
      totalCents: null,
    });
    assert.equal(row.quantity, null);
    assert.equal(row.unit_price_cents, null);
    assert.equal(row.total_cents, null);
  });
});

describe('normalizeOrdersArray', () => {
  it('unwraps nested orders/items/results/data and returns [] otherwise', () => {
    assert.deepEqual(normalizeOrdersArray({ data: { results: [{ id: 1 }] } }), [{ id: 1 }]);
    assert.deepEqual(normalizeOrdersArray([{ id: 2 }]), [{ id: 2 }]);
    assert.deepEqual(normalizeOrdersArray({ foo: 1 }), []);
    assert.deepEqual(normalizeOrdersArray(null), []);
  });

  it('does not infinite-loop on cyclic objects', () => {
    const cyclic = { data: {} };
    cyclic.data.self = cyclic;
    assert.deepEqual(normalizeOrdersArray(cyclic), []);
  });
});

describe('pickInvoiceDate', () => {
  it('prefers completedDate and slices to YYYY-MM-DD', () => {
    assert.equal(
      pickInvoiceDate({ completedDate: '2026-03-15T18:00:00.000Z', created_date: '2026-01-01' }),
      '2026-03-15'
    );
    assert.equal(pickInvoiceDate({ created_date: '2026-01-01' }), '2026-01-01');
    assert.equal(pickInvoiceDate({}), null);
  });
});

describe('computeShopmonkeyInvoiceMoney', () => {
  it('uses explicit totalCents when finite', () => {
    assert.deepEqual(
      computeShopmonkeyInvoiceMoney({ laborCents: 100, partsCents: 200, totalCents: 999 }),
      { laborCents: 100, partsCents: 200, feesCents: null, taxCents: null, totalCents: 999 }
    );
  });

  it('sums labor/parts/fees/tax when total is missing and at least one bucket is finite', () => {
    assert.deepEqual(
      computeShopmonkeyInvoiceMoney({ laborCents: 100, partsCents: 50, taxCents: 8 }),
      { laborCents: 100, partsCents: 50, feesCents: null, taxCents: 8, totalCents: 158 }
    );
    assert.equal(computeShopmonkeyInvoiceMoney({ laborCents: 0 }).totalCents, 0);
  });

  it('returns null totals when no money fields are finite', () => {
    assert.deepEqual(computeShopmonkeyInvoiceMoney({}), {
      laborCents: null,
      partsCents: null,
      feesCents: null,
      taxCents: null,
      totalCents: null,
    });
    assert.equal(computeShopmonkeyInvoiceMoney({ totalCents: 'nope' }).totalCents, null);
  });
});

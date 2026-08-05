import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldIncludeShopMonkeyLineItem,
  cleanShopMonkeyLineDescription,
  mapShopMonkeyLineItemsToWorkItems,
  extractVehicleInfoFromOrder,
} from '../utils/shopmonkeyOrderExtract.js';

describe('shouldIncludeShopMonkeyLineItem', () => {
  it('includes Part / Labor / Service when lineItemType is set', () => {
    assert.equal(shouldIncludeShopMonkeyLineItem({ lineItemType: 'Part', name: 'Oil Filter' }), true);
    assert.equal(shouldIncludeShopMonkeyLineItem({ lineItemType: 'Labor', name: 'Install filter' }), true);
    assert.equal(shouldIncludeShopMonkeyLineItem({ lineItemType: 'Service', name: 'Oil change' }), true);
  });

  it('excludes explicit fee / tax / supply types', () => {
    assert.equal(shouldIncludeShopMonkeyLineItem({ lineItemType: 'Fee', name: 'Shop supplies' }), false);
    assert.equal(shouldIncludeShopMonkeyLineItem({ lineItemType: 'Tax', name: 'Sales Tax' }), false);
    assert.equal(shouldIncludeShopMonkeyLineItem({ lineItemType: 'Discount', name: 'Promo' }), false);
  });

  it('includes untyped items with a meaningful description', () => {
    assert.equal(shouldIncludeShopMonkeyLineItem({ name: 'Brake pads' }), true);
  });

  it('rejects empty, short, or price-only descriptions', () => {
    assert.equal(shouldIncludeShopMonkeyLineItem({ lineItemType: 'Part', name: 'ab' }), false);
    assert.equal(shouldIncludeShopMonkeyLineItem({ lineItemType: 'Part', name: '$12.50' }), false);
    assert.equal(shouldIncludeShopMonkeyLineItem(null), false);
  });
});

describe('cleanShopMonkeyLineDescription', () => {
  it('strips prices, qty, and part numbers', () => {
    assert.equal(
      cleanShopMonkeyLineDescription('Motor Oil Part #: 5W30 $9.32 QTY: 7'),
      'Motor Oil'
    );
    assert.equal(
      cleanShopMonkeyLineDescription('Filter P/N: ABC-123 12.00'),
      'Filter'
    );
  });
});

describe('mapShopMonkeyLineItemsToWorkItems', () => {
  it('keeps parts/labor, drops fees, dedupes case-insensitively', () => {
    const items = mapShopMonkeyLineItemsToWorkItems([
      { lineItemType: 'Part', name: 'Oil Filter' },
      { lineItemType: 'Fee', name: 'Shop Fee' },
      { lineItemType: 'Labor', name: 'oil filter' },
      { lineItemType: 'Service', name: 'Oil Change' },
    ]);
    assert.deepEqual(
      items.map((i) => i.title),
      ['Oil Filter', 'Oil Change']
    );
  });

  it('returns empty array for non-array input', () => {
    assert.deepEqual(mapShopMonkeyLineItemsToWorkItems(null), []);
  });
});

describe('extractVehicleInfoFromOrder', () => {
  it('maps vehicle, RO number, and customer name', () => {
    assert.deepEqual(
      extractVehicleInfoFromOrder({
        number: 1042,
        vehicle: { year: 2020, make: 'Toyota', model: 'Tacoma', vin: '1HGCM82633A004352', mileage: 55210 },
        customer: { name: 'Ada Lovelace' },
      }),
      {
        year: 2020,
        make: 'Toyota',
        model: 'Tacoma',
        vin: '1HGCM82633A004352',
        mileage: '55210',
        repairOrderNumber: '1042',
        customerName: 'Ada Lovelace',
      }
    );
  });

  it('returns empty object for missing order / vehicle', () => {
    assert.deepEqual(extractVehicleInfoFromOrder(null), {});
    assert.deepEqual(extractVehicleInfoFromOrder({}), {});
  });
});

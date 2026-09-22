import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { turn14CatalogPrice } from '../src/utils/turn14CatalogPrice.js';

describe('turn14CatalogPrice', () => {
  it('uses a numeric or string list price when one is present', () => {
    assert.equal(turn14CatalogPrice({ price: 19.99, pricing: { amount: 1 } }), 19.99);
    assert.equal(turn14CatalogPrice({ price: '19.99', pricing: { amount: 1 } }), '19.99');
  });

  it('falls through a numeric zero to pricing.amount, then pricing.value', () => {
    assert.equal(turn14CatalogPrice({ price: 0, pricing: { amount: 12.5 } }), 12.5);
    assert.equal(turn14CatalogPrice({ pricing: { amount: 0, value: 8 } }), 8);
  });

  it('keeps a string zero because it is truthy in the catalog || chain', () => {
    assert.equal(turn14CatalogPrice({ price: '0', pricing: { amount: 12.5 } }), '0');
  });

  it('stores "0" when the part has no price fields', () => {
    assert.equal(turn14CatalogPrice({}), '0');
    assert.equal(turn14CatalogPrice({ price: '', pricing: { amount: '', value: null } }), '0');
  });
});

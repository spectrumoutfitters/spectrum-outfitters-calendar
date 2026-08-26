import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyOrderItemEdit,
  computeOrderItemsTotal,
  lineItemAmount,
} from '../src/utils/orderEditItemTotal.js';

describe('lineItemAmount / computeOrderItemsTotal', () => {
  it('multiplies parseFloat price by parseInt quantity, treating 0/empty qty as 1', () => {
    assert.equal(lineItemAmount({ price: 10, quantity: 2 }), 20);
    assert.equal(lineItemAmount({ price: '10.50', quantity: '2' }), 21);
    assert.equal(lineItemAmount({ price: 10, quantity: 0 }), 10);
    assert.equal(lineItemAmount({ price: 10, quantity: '' }), 10);
    assert.equal(lineItemAmount({ price: 10, quantity: null }), 10);
    assert.equal(lineItemAmount({ price: 0, quantity: 3 }), 0);
    assert.equal(lineItemAmount({ price: '', quantity: 3 }), 0);
    assert.equal(lineItemAmount({ price: '12abc', quantity: '2xyz' }), 24);
    assert.equal(computeOrderItemsTotal([]), 0);
    assert.equal(
      computeOrderItemsTotal([
        { price: 10, quantity: 1 },
        { price: 5, quantity: 2 },
      ]),
      20,
    );
  });
});

describe('applyOrderItemEdit', () => {
  const products = [
    { id: 7, price: 49.99 },
    { id: 8, price: 12 },
  ];

  it('copies catalog price when product_id is truthy and restamps total', () => {
    const items = [{ product_id: '', quantity: 2, price: 0 }];
    const next = applyOrderItemEdit(items, 0, 'product_id', '7', products);
    assert.equal(next.items[0].product_id, '7');
    assert.equal(next.items[0].price, 49.99);
    assert.equal(next.total_amount, 99.98);
  });

  it('skips catalog lookup for falsy product_id (including 0)', () => {
    const items = [{ product_id: 7, quantity: 1, price: 49.99 }];
    const cleared = applyOrderItemEdit(items, 0, 'product_id', '', products);
    assert.equal(cleared.items[0].price, 49.99);
    const zeroId = applyOrderItemEdit(items, 0, 'product_id', 0, products);
    assert.equal(zeroId.items[0].price, 49.99);
  });

  it('restamps total when quantity changes, including the 0 → 1 coercion', () => {
    const items = [{ product_id: 8, quantity: 1, price: 12 }];
    const two = applyOrderItemEdit(items, 0, 'quantity', 2, products);
    assert.equal(two.total_amount, 24);
    const zero = applyOrderItemEdit(items, 0, 'quantity', 0, products);
    assert.equal(zero.items[0].quantity, 0);
    assert.equal(zero.total_amount, 12);
  });
});

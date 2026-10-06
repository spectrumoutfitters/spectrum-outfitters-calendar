import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addProductToCart, sumCartTotal, updateCartQuantity } from '../src/utils/storeCart.js';

const oil = { id: 1, name: 'Oil', price: 12 };
const filter = { id: 2, name: 'Filter', price: 8 };

describe('addProductToCart', () => {
  it('appends a new line at quantity 1 and does not mutate the previous cart', () => {
    const cart = [];
    const next = addProductToCart(cart, oil);
    assert.deepEqual(cart, []);
    assert.deepEqual(next, [
      { product_id: 1, product_name: 'Oil', price: 12, quantity: 1 },
    ]);
  });

  it('increments only the matching product id', () => {
    const cart = addProductToCart(addProductToCart([], oil), filter);
    const next = addProductToCart(cart, oil);
    assert.equal(next[0].quantity, 2);
    assert.equal(next[1].quantity, 1);
    assert.equal(cart[0].quantity, 1);
  });
});

describe('updateCartQuantity', () => {
  const cart = [
    { product_id: 1, product_name: 'Oil', price: 12, quantity: 2 },
    { product_id: 2, product_name: 'Filter', price: 8, quantity: 1 },
  ];

  it('removes a line at quantity 0 or below and leaves other lines', () => {
    assert.deepEqual(updateCartQuantity(cart, 1, 0), [cart[1]]);
    assert.deepEqual(updateCartQuantity(cart, 2, -1), [cart[0]]);
    assert.equal(cart[0].quantity, 2);
  });

  it('keeps fractional quantities above zero', () => {
    const next = updateCartQuantity(cart, 1, 0.5);
    assert.equal(next[0].quantity, 0.5);
    assert.equal(next[1].quantity, 1);
  });
});

describe('sumCartTotal', () => {
  it('sums price times quantity, including a free line and an empty cart', () => {
    assert.equal(sumCartTotal([]), 0);
    assert.equal(
      sumCartTotal([
        { price: 12, quantity: 2 },
        { price: 8, quantity: 1 },
        { price: 0, quantity: 4 },
      ]),
      32
    );
  });

  it('coerces numeric strings the same way the checkout total does', () => {
    assert.equal(sumCartTotal([{ price: '12.5', quantity: '2' }]), 25);
  });
});

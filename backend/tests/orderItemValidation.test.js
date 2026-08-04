import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderItemLines } from '../utils/orderItemValidation.js';

describe('validateOrderItemLines', () => {
  it('rejects empty items', () => {
    assert.equal(validateOrderItemLines([]).ok, false);
    assert.equal(validateOrderItemLines(null).ok, false);
  });

  it('rejects zero, negative, and non-integer quantities', () => {
    assert.match(validateOrderItemLines([{ product_id: 1, quantity: 0 }]).error, /positive integer/);
    assert.match(validateOrderItemLines([{ product_id: 1, quantity: -3 }]).error, /positive integer/);
    assert.match(validateOrderItemLines([{ product_id: 1, quantity: 1.5 }]).error, /positive integer/);
    assert.match(validateOrderItemLines([{ product_id: 1 }]).error, /positive integer/);
  });

  it('rejects negative price overrides', () => {
    const r = validateOrderItemLines([{ product_id: 1, quantity: 2, price: -1 }]);
    assert.equal(r.ok, false);
    assert.match(r.error, /non-negative/);
  });

  it('accepts valid lines', () => {
    const r = validateOrderItemLines([
      { product_id: 9, quantity: 2 },
      { product_id: 3, quantity: '4', price: '12.5' },
    ]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.lines, [
      { product_id: 9, quantity: 2, priceOverride: null },
      { product_id: 3, quantity: 4, priceOverride: 12.5 },
    ]);
  });
});

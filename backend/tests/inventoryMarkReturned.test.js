import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideMarkReturned } from '../utils/inventoryMarkReturned.js';

describe('decideMarkReturned', () => {
  it('decrements only the flagged units on a partial return and keeps the SKU in stock', () => {
    const result = decideMarkReturned({ quantity: 10, returnQuantity: 2 });
    assert.deepEqual(result, {
      qtyToRemove: 2,
      quantityAfter: 8,
      fullyReturned: false,
      unlinkTaskUsage: false,
      setReturnedAt: false
    });
  });

  it('treats return_quantity equal to on-hand as a full return', () => {
    const result = decideMarkReturned({ quantity: 5, returnQuantity: 5 });
    assert.equal(result.qtyToRemove, 5);
    assert.equal(result.quantityAfter, 0);
    assert.equal(result.fullyReturned, true);
    assert.equal(result.unlinkTaskUsage, true);
    assert.equal(result.setReturnedAt, true);
  });

  it('treats missing return_quantity as returning all remaining units (qty=1 path)', () => {
    const result = decideMarkReturned({ quantity: 1, returnQuantity: null });
    assert.equal(result.qtyToRemove, 1);
    assert.equal(result.quantityAfter, 0);
    assert.equal(result.fullyReturned, true);
  });

  it('does not hide leftover stock when on-hand dropped below the original return request', () => {
    const result = decideMarkReturned({ quantity: 3, returnQuantity: 8 });
    assert.equal(result.qtyToRemove, 3);
    assert.equal(result.quantityAfter, 0);
    assert.equal(result.fullyReturned, true);
  });

  it('no-ops when there is no on-hand quantity', () => {
    const result = decideMarkReturned({ quantity: 0, returnQuantity: 2 });
    assert.equal(result.qtyToRemove, 0);
    assert.equal(result.quantityAfter, 0);
    assert.equal(result.fullyReturned, true);
  });
});

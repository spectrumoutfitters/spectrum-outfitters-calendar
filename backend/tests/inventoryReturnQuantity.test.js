import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentInventoryQuantity,
  parseInventoryReturnQuantity,
} from '../utils/inventoryReturnQuantity.js';

describe('currentInventoryQuantity', () => {
  it('coerces nullish on-hand to 0 and otherwise uses Number()', () => {
    assert.equal(currentInventoryQuantity(null), 0);
    assert.equal(currentInventoryQuantity(undefined), 0);
    assert.equal(currentInventoryQuantity(5), 5);
    assert.equal(currentInventoryQuantity('3.5'), 3.5);
    assert.equal(Number.isNaN(currentInventoryQuantity('abc')), true);
  });
});

describe('parseInventoryReturnQuantity', () => {
  it('requires an explicit qty when more than one unit is on hand', () => {
    assert.deepEqual(parseInventoryReturnQuantity(undefined, 5), {
      error: 'Please specify how many need to be returned.',
    });
    assert.deepEqual(parseInventoryReturnQuantity('', 2), {
      error: 'Please specify how many need to be returned.',
    });
  });

  it('defaults omitted qty to effective 1 when on-hand is 0 or 1, storing null', () => {
    assert.deepEqual(parseInventoryReturnQuantity(undefined, 1), {
      returnQty: null,
      effectiveReturnQty: 1,
    });
    assert.deepEqual(parseInventoryReturnQuantity(null, 0), {
      returnQty: null,
      effectiveReturnQty: 1,
    });
  });

  it('rejects non-finite or sub-1 parsed quantities', () => {
    assert.deepEqual(parseInventoryReturnQuantity('nope', 5), {
      error: 'Return quantity must be at least 1.',
    });
    assert.deepEqual(parseInventoryReturnQuantity(0, 5), {
      error: 'Return quantity must be at least 1.',
    });
    assert.deepEqual(parseInventoryReturnQuantity(-2, 5), {
      error: 'Return quantity must be at least 1.',
    });
  });

  it('blocks exceeding on-hand only when currentQty > 1', () => {
    assert.deepEqual(parseInventoryReturnQuantity(6, 5), {
      error: 'Return quantity cannot exceed current quantity (5).',
    });
    // qty of 1 skips the exceed check, then floors
    assert.deepEqual(parseInventoryReturnQuantity(9, 1), {
      returnQty: 9,
      effectiveReturnQty: 9,
    });
  });

  it('floors decimals after the exceed check (raw parse vs on-hand)', () => {
    assert.deepEqual(parseInventoryReturnQuantity(2.9, 5), {
      returnQty: 2,
      effectiveReturnQty: 2,
    });
    assert.deepEqual(parseInventoryReturnQuantity(1.6, 1.5), {
      error: 'Return quantity cannot exceed current quantity (1.5).',
    });
    assert.deepEqual(parseInventoryReturnQuantity(1.5, 1.5), {
      returnQty: 1,
      effectiveReturnQty: 1,
    });
  });
});

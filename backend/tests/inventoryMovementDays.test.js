import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  movementSummaryDays,
  movementSummarySinceExpr,
  isLowStockItem,
} from '../utils/inventoryMovementDays.js';

describe('movementSummaryDays', () => {
  it('defaults falsy daysRaw (undefined / null / "" / 0) to 30', () => {
    for (const raw of [undefined, null, '', 0, false]) {
      assert.equal(movementSummaryDays(raw), 30, String(raw));
    }
  });

  it('treats string "0" as 0 (truthy string), then clamps to 1', () => {
    assert.equal(movementSummaryDays('0'), 1);
  });

  it('clamps below 1 up to 1 and above 365 down to 365', () => {
    assert.equal(movementSummaryDays(-5), 1);
    assert.equal(movementSummaryDays(400), 365);
    assert.equal(movementSummaryDays(365), 365);
    assert.equal(movementSummaryDays(1), 1);
    assert.equal(movementSummaryDays(90), 90);
  });

  it('does not floor fractions; non-numeric strings stay NaN', () => {
    assert.equal(movementSummaryDays(1.5), 1.5);
    assert.ok(Number.isNaN(movementSummaryDays('abc')));
    assert.equal(movementSummarySinceExpr('abc'), '-NaN days');
  });
});

describe('isLowStockItem', () => {
  it('uses quantity <= min_quantity when min is set (including 0)', () => {
    assert.equal(isLowStockItem({ quantity: 3, min_quantity: 3 }), true);
    assert.equal(isLowStockItem({ quantity: 2, min_quantity: 3 }), true);
    assert.equal(isLowStockItem({ quantity: 4, min_quantity: 3 }), false);
    assert.equal(isLowStockItem({ quantity: 0, min_quantity: 0 }), true);
    assert.equal(isLowStockItem({ quantity: 1, min_quantity: 0 }), false);
  });

  it('defaults to quantity < 3 when min_quantity is null/undefined', () => {
    assert.equal(isLowStockItem({ quantity: 2, min_quantity: null }), true);
    assert.equal(isLowStockItem({ quantity: 3, min_quantity: null }), false);
    assert.equal(isLowStockItem({ quantity: 0 }), true);
    assert.equal(isLowStockItem({ quantity: 3 }), false);
  });
});

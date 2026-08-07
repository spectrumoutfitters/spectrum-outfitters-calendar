import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTENTION_LEVELS,
  LEVEL_ORDER,
  formatQuantityWithSize,
  getInventoryLevel,
  getTileColorClass,
} from '../src/utils/inventoryStockDisplay.js';

describe('getInventoryLevel', () => {
  it('flags needs_return ahead of stock quantity', () => {
    assert.equal(
      getInventoryLevel({ needs_return: 1, quantity: 10, min_quantity: 2 }),
      'return_needed'
    );
  });

  it('ignores needs_return after returned_at is set', () => {
    assert.equal(
      getInventoryLevel({
        needs_return: 1,
        returned_at: '2026-01-01',
        quantity: 0,
        min_quantity: 1,
      }),
      'out'
    );
  });

  it('returns no_min when min_quantity is null or empty', () => {
    assert.equal(getInventoryLevel({ quantity: 0 }), 'no_min');
    assert.equal(getInventoryLevel({ quantity: 5, min_quantity: '' }), 'no_min');
    assert.equal(getInventoryLevel({ quantity: 5, min_quantity: null }), 'no_min');
  });

  it('classifies out / low / ok against min_quantity', () => {
    assert.equal(getInventoryLevel({ quantity: 0, min_quantity: 1 }), 'out');
    assert.equal(getInventoryLevel({ quantity: -1, min_quantity: 1 }), 'out');
    assert.equal(getInventoryLevel({ quantity: 2, min_quantity: 5 }), 'low');
    assert.equal(getInventoryLevel({ quantity: 5, min_quantity: 5 }), 'ok');
    assert.equal(getInventoryLevel({ quantity: 6, min_quantity: 5 }), 'ok');
  });

  it('treats missing quantity as 0', () => {
    assert.equal(getInventoryLevel({ min_quantity: 1 }), 'out');
  });
});

describe('formatQuantityWithSize', () => {
  it('returns quantity + unit when size_per_unit absent', () => {
    assert.equal(formatQuantityWithSize({ quantity: 3, unit: 'bottle' }), '3 bottle');
    assert.equal(formatQuantityWithSize({ quantity: 2 }), '2 each');
    assert.equal(formatQuantityWithSize({}), '0 each');
  });

  it('shows fluid equivalent when size_per_unit is numeric with unit', () => {
    assert.equal(
      formatQuantityWithSize({ quantity: 0.5, unit: 'bottle', size_per_unit: '32 oz' }),
      '16 oz (0.5 of 32 oz)'
    );
  });

  it('defaults size suffix to oz when only a number is provided', () => {
    assert.equal(
      formatQuantityWithSize({ quantity: 2, unit: 'bottle', size_per_unit: '32' }),
      '64 oz (2 of 32 oz)'
    );
  });

  it('formats non-integer equivalents to one decimal', () => {
    assert.equal(
      formatQuantityWithSize({ quantity: 0.3, unit: 'bottle', size_per_unit: '32 oz' }),
      '9.6 oz (0.3 of 32 oz)'
    );
  });

  it('falls back to base when size_per_unit is unparseable', () => {
    assert.equal(
      formatQuantityWithSize({ quantity: 1, unit: 'each', size_per_unit: 'n/a' }),
      '1 each'
    );
  });
});

describe('getTileColorClass', () => {
  it('maps levels to distinct border/background classes', () => {
    assert.match(getTileColorClass({ needs_return: true, quantity: 9, min_quantity: 1 }), /orange/);
    assert.match(getTileColorClass({ quantity: 0, min_quantity: 1 }), /red/);
    assert.match(getTileColorClass({ quantity: 1, min_quantity: 5 }), /amber/);
    assert.match(getTileColorClass({ quantity: 5, min_quantity: 5 }), /green/);
    assert.match(getTileColorClass({ quantity: 3 }), /border-gray-200/);
  });
});

describe('attention constants', () => {
  it('orders levels with attention first', () => {
    assert.deepEqual(LEVEL_ORDER, ['return_needed', 'out', 'low', 'ok', 'no_min']);
    assert.ok(ATTENTION_LEVELS.has('return_needed'));
    assert.ok(ATTENTION_LEVELS.has('out'));
    assert.ok(ATTENTION_LEVELS.has('low'));
    assert.equal(ATTENTION_LEVELS.has('ok'), false);
  });
});

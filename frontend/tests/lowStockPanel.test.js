import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lowStockAlreadyRequested,
  lowStockDisplayQuantity,
  lowStockIsOut,
  lowStockStillNeedsReorder,
} from '../src/utils/lowStockPanel.js';

describe('lowStockIsOut', () => {
  it('treats null, undefined, zero, and negative quantities as out', () => {
    assert.equal(lowStockDisplayQuantity(null), 0);
    assert.equal(lowStockDisplayQuantity(undefined), 0);
    assert.equal(lowStockIsOut(null), true);
    assert.equal(lowStockIsOut(undefined), true);
    assert.equal(lowStockIsOut(0), true);
    assert.equal(lowStockIsOut(-3), true);
  });

  it('keeps a positive quantity in the low-stock state', () => {
    assert.equal(lowStockDisplayQuantity(2), 2);
    assert.equal(lowStockIsOut(2), false);
    assert.equal(lowStockIsOut(0.5), false);
  });
});

describe('lowStockStillNeedsReorder', () => {
  it('skips ids already requested and keeps the rest', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const pending = lowStockStillNeedsReorder(items, new Set([2]));
    assert.deepEqual(pending.map((it) => it.id), [1, 3]);
    assert.equal(lowStockAlreadyRequested(2, new Set([2])), true);
    assert.equal(lowStockAlreadyRequested(1, new Set([2])), false);
  });

  it('matches ids strictly so a string id is not the numeric id', () => {
    const items = [{ id: 1 }, { id: '1' }];
    const pending = lowStockStillNeedsReorder(items, new Set([1]));
    assert.deepEqual(pending.map((it) => it.id), ['1']);
  });

  it('returns every item when none are requested and nothing for an empty list', () => {
    const items = [{ id: 'a' }];
    assert.deepEqual(lowStockStillNeedsReorder(items, new Set()).map((it) => it.id), ['a']);
    assert.deepEqual(lowStockStillNeedsReorder([], new Set()), []);
    assert.deepEqual(lowStockStillNeedsReorder(null, new Set()), []);
  });
});

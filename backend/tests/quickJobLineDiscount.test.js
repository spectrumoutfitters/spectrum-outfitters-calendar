import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyQuickJobLineDiscount } from '../utils/quickJobLineDiscount.js';

describe('applyQuickJobLineDiscount', () => {
  it('treats $ off as dollars against a cent line total', () => {
    // $100.00 line, admin types 10 in "$ off line"
    assert.equal(applyQuickJobLineDiscount(10000, 'amount', 10), 9000);
    assert.equal(applyQuickJobLineDiscount(10000, 'amount', 10.5), 8950);
  });

  it('does not charge below zero when the dollar discount exceeds the line', () => {
    assert.equal(applyQuickJobLineDiscount(500, 'amount', 10), 0);
  });

  it('applies percent off to the cent total', () => {
    assert.equal(applyQuickJobLineDiscount(10000, 'percent', 10), 9000);
    assert.equal(applyQuickJobLineDiscount(9999, 'percent', 10), 8999);
  });

  it('leaves the total unchanged when there is no discount', () => {
    assert.equal(applyQuickJobLineDiscount(10000, null, null), 10000);
    assert.equal(applyQuickJobLineDiscount(10000, 'amount', null), 10000);
    assert.equal(applyQuickJobLineDiscount(10000, '', 10), 10000);
  });
});

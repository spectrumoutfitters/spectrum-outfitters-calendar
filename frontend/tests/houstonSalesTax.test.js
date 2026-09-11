import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSTON_TX_SALES_TAX_RATE,
  estimatedHoustonSalesTax,
} from '../src/utils/houstonSalesTax.js';

describe('estimatedHoustonSalesTax', () => {
  it('uses the Houston 8.25% rate and two-decimal string', () => {
    assert.equal(HOUSTON_TX_SALES_TAX_RATE, 0.0825);
    assert.equal(estimatedHoustonSalesTax(100), '8.25');
    assert.equal(estimatedHoustonSalesTax('100'), '8.25');
  });

  it('maps non-numeric input to 0.00 via parseFloat || 0', () => {
    assert.equal(estimatedHoustonSalesTax(''), '0.00');
    assert.equal(estimatedHoustonSalesTax('abc'), '0.00');
    assert.equal(estimatedHoustonSalesTax(null), '0.00');
    assert.equal(estimatedHoustonSalesTax(undefined), '0.00');
  });

  it('keeps greedy parseFloat and negative taxable (current coerce)', () => {
    assert.equal(estimatedHoustonSalesTax('12.345'), (12.345 * 0.0825).toFixed(2));
    assert.equal(estimatedHoustonSalesTax('-10'), (-10 * 0.0825).toFixed(2));
    assert.equal(estimatedHoustonSalesTax('10xyz'), (10 * 0.0825).toFixed(2));
  });
});

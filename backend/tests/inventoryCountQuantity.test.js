import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCountQuantity, normalizeCountViscosity } from '../utils/inventoryCountQuantity.js';

describe('parseCountQuantity', () => {
  it('accepts 0 and finite positives, including greedy parseFloat prefixes', () => {
    assert.deepEqual(parseCountQuantity(0), { ok: true, quantity: 0 });
    assert.deepEqual(parseCountQuantity('0'), { ok: true, quantity: 0 });
    assert.deepEqual(parseCountQuantity('1.5'), { ok: true, quantity: 1.5 });
    assert.deepEqual(parseCountQuantity('  3 '), { ok: true, quantity: 3 });
    assert.deepEqual(parseCountQuantity('12abc'), { ok: true, quantity: 12 });
    // parseFloat stringifies first, so numeric -0 becomes +0
    assert.deepEqual(parseCountQuantity(-0), { ok: true, quantity: 0 });
    assert.equal(Object.is(parseCountQuantity('-0').quantity, -0), true);
    assert.equal(parseCountQuantity('-0').ok, true);
  });

  it('rejects non-finite values', () => {
    assert.equal(parseCountQuantity(undefined).ok, false);
    assert.equal(parseCountQuantity(null).ok, false);
    assert.equal(parseCountQuantity('').ok, false);
    assert.equal(parseCountQuantity('abc').ok, false);
    assert.equal(parseCountQuantity(Number.NaN).ok, false);
    assert.equal(parseCountQuantity(Infinity).ok, false);
    assert.match(parseCountQuantity('nope').error, /must be a number/);
  });

  it('rejects negatives', () => {
    assert.equal(parseCountQuantity(-1).ok, false);
    assert.equal(parseCountQuantity('-0.1').ok, false);
    assert.match(parseCountQuantity(-3).error, /cannot be negative/);
  });
});

describe('normalizeCountViscosity', () => {
  it('stores trimmed text; omitted/blank become null; 0 stays "0"', () => {
    assert.equal(normalizeCountViscosity(undefined), null);
    assert.equal(normalizeCountViscosity(null), null);
    assert.equal(normalizeCountViscosity(''), null);
    assert.equal(normalizeCountViscosity('  '), null);
    assert.equal(normalizeCountViscosity('  5W-30  '), '5W-30');
    assert.equal(normalizeCountViscosity(0), '0');
    assert.equal(normalizeCountViscosity(false), 'false');
  });
});

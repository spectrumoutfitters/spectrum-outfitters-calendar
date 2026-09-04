import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isFluidOrConsumable,
  quantityUsedForLink,
  quantityUsedForUpdate,
} from '../src/utils/taskInventoryLinkQty.js';

describe('isFluidOrConsumable', () => {
  it('matches category substrings case-insensitively', () => {
    assert.equal(isFluidOrConsumable({ category_name: 'Motor Oil' }), true);
    assert.equal(isFluidOrConsumable({ category_name: 'FLUIDS' }), true);
    assert.equal(isFluidOrConsumable({ category_name: 'Cleaning supplies' }), true);
    assert.equal(isFluidOrConsumable({ category_name: 'PPF' }), false);
  });

  it('matches unit or item_unit substrings', () => {
    assert.equal(isFluidOrConsumable({ unit: 'fl oz' }), true);
    assert.equal(isFluidOrConsumable({ item_unit: 'QT' }), true);
    assert.equal(isFluidOrConsumable({ unit: 'gallon' }), true);
    assert.equal(isFluidOrConsumable({ unit: 'bottle' }), true);
    assert.equal(isFluidOrConsumable({ unit: 'can' }), true);
    assert.equal(isFluidOrConsumable({ unit: 'each' }), false);
  });

  it('treats missing item / empty strings as discrete', () => {
    assert.equal(isFluidOrConsumable(null), false);
    assert.equal(isFluidOrConsumable({}), false);
    assert.equal(isFluidOrConsumable({ category_name: '', unit: '' }), false);
  });
});

describe('quantityUsedForLink', () => {
  const oil = { category_name: 'Oil' };
  const clip = { category_name: 'Hardware', unit: 'each' };

  it('discrete parts always post 1, ignoring qty', () => {
    assert.equal(quantityUsedForLink(clip), 1);
    assert.equal(quantityUsedForLink(clip, '3'), 1);
    assert.equal(quantityUsedForLink(clip, 0), 1);
    assert.equal(quantityUsedForLink(clip, ''), 1);
  });

  it('fluids omit qty when input is undefined / null / empty', () => {
    assert.equal(quantityUsedForLink(oil), null);
    assert.equal(quantityUsedForLink(oil, undefined), null);
    assert.equal(quantityUsedForLink(oil, null), null);
    assert.equal(quantityUsedForLink(oil, ''), null);
  });

  it('fluids coerce via parseFloat || null (0 and NaN become null)', () => {
    assert.equal(quantityUsedForLink(oil, '2.5'), 2.5);
    assert.equal(quantityUsedForLink(oil, 4), 4);
    assert.equal(quantityUsedForLink(oil, '0'), null);
    assert.equal(quantityUsedForLink(oil, 0), null);
    assert.equal(quantityUsedForLink(oil, 'abc'), null);
  });
});

describe('quantityUsedForUpdate', () => {
  it('blank or null clears the field; 0 is kept; non-numeric is NaN', () => {
    assert.equal(quantityUsedForUpdate(''), null);
    assert.equal(quantityUsedForUpdate(null), null);
    assert.equal(quantityUsedForUpdate(0), 0);
    assert.equal(quantityUsedForUpdate('0'), 0);
    assert.equal(quantityUsedForUpdate('1.25'), 1.25);
    assert.ok(Number.isNaN(quantityUsedForUpdate('abc')));
    assert.ok(Number.isNaN(quantityUsedForUpdate(undefined)));
  });
});

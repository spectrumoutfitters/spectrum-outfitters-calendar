import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canSeeInactiveProducts,
  isProductCreateMissing,
  coerceCreateIsActive,
  coerceUpdateIsActive,
  coerceProductPrice,
  coerceCreateDescription,
  coerceUpdateDescription,
  coerceUpdateName,
} from '../utils/productActiveFlags.js';

describe('canSeeInactiveProducts', () => {
  it('allows only the exact string admin', () => {
    assert.equal(canSeeInactiveProducts('admin'), true);
    assert.equal(canSeeInactiveProducts('Admin'), false);
    assert.equal(canSeeInactiveProducts('employee'), false);
    assert.equal(canSeeInactiveProducts('administrator'), false);
    assert.equal(canSeeInactiveProducts(true), false);
  });
});

describe('isProductCreateMissing', () => {
  it('requires a truthy name and price (so $0 is rejected)', () => {
    assert.equal(isProductCreateMissing('Widget', 12.5), false);
    assert.equal(isProductCreateMissing('Widget', '9.99'), false);
    assert.equal(isProductCreateMissing('', 12.5), true);
    assert.equal(isProductCreateMissing('Widget', 0), true);
    assert.equal(isProductCreateMissing('Widget', ''), true);
    assert.equal(isProductCreateMissing('Widget', null), true);
    assert.equal(isProductCreateMissing(undefined, 5), true);
  });
});

describe('coerceCreateIsActive', () => {
  it('stores 0 only for the string false; everything else including boolean false is 1', () => {
    assert.equal(coerceCreateIsActive('false'), 0);
    assert.equal(coerceCreateIsActive(false), 1);
    assert.equal(coerceCreateIsActive('true'), 1);
    assert.equal(coerceCreateIsActive(true), 1);
    assert.equal(coerceCreateIsActive(0), 1);
    assert.equal(coerceCreateIsActive('0'), 1);
    assert.equal(coerceCreateIsActive(undefined), 1);
    assert.equal(coerceCreateIsActive(null), 1);
  });
});

describe('coerceUpdateIsActive', () => {
  it('keeps current when omitted, and only exact true/\'true\' activate', () => {
    assert.equal(coerceUpdateIsActive(undefined, 1), 1);
    assert.equal(coerceUpdateIsActive(undefined, 0), 0);
    assert.equal(coerceUpdateIsActive(true, 0), 1);
    assert.equal(coerceUpdateIsActive('true', 0), 1);
    assert.equal(coerceUpdateIsActive('TRUE', 1), 0);
    assert.equal(coerceUpdateIsActive(1, 1), 0);
    assert.equal(coerceUpdateIsActive('1', 1), 0);
    assert.equal(coerceUpdateIsActive(false, 1), 0);
    assert.equal(coerceUpdateIsActive('false', 1), 0);
  });
});

describe('coerceProductPrice', () => {
  it('parses when provided and keeps current when omitted, including NaN for junk', () => {
    assert.equal(coerceProductPrice('12.50', 9), 12.5);
    assert.equal(coerceProductPrice(undefined, 9), 9);
    assert.equal(Number.isNaN(coerceProductPrice('abc', 9)), true);
    assert.equal(coerceProductPrice(0, 9), 0);
  });
});

describe('description and name coercion', () => {
  it('create description nulls falsy values', () => {
    assert.equal(coerceCreateDescription('  steel  '), '  steel  ');
    assert.equal(coerceCreateDescription(''), null);
    assert.equal(coerceCreateDescription(undefined), null);
  });

  it('update description can store empty string, unlike create', () => {
    assert.equal(coerceUpdateDescription('', 'kept'), '');
    assert.equal(coerceUpdateDescription(undefined, 'kept'), 'kept');
    assert.equal(coerceUpdateDescription('new', 'kept'), 'new');
  });

  it('update name keeps current when incoming is falsy', () => {
    assert.equal(coerceUpdateName('', 'Bolt'), 'Bolt');
    assert.equal(coerceUpdateName(null, 'Bolt'), 'Bolt');
    assert.equal(coerceUpdateName('Nut', 'Bolt'), 'Nut');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  centsToDollarInput,
  coerceQuickJobSavePayload,
  dollarsInputToCents,
  isQuickJobActive,
} from '../src/utils/quickJobsItemMoney.js';

describe('isQuickJobActive', () => {
  it('only exact 0 is inactive (false / "0" / null still show as active)', () => {
    assert.equal(isQuickJobActive(0), false);
    assert.equal(isQuickJobActive(1), true);
    assert.equal(isQuickJobActive(true), true);
    assert.equal(isQuickJobActive(false), true);
    assert.equal(isQuickJobActive('0'), true);
    assert.equal(isQuickJobActive(null), true);
    assert.equal(isQuickJobActive(undefined), true);
  });
});

describe('dollarsInputToCents / centsToDollarInput', () => {
  it('rounds half-up via Math.round; blank/non-finite become null', () => {
    assert.equal(dollarsInputToCents('99.99'), 9999);
    assert.equal(dollarsInputToCents('1.005'), 100); // 1.005*100 is 100.4999… in IEEE float
    assert.equal(dollarsInputToCents('0'), 0);
    assert.equal(dollarsInputToCents('-1.5'), -150);
    assert.equal(dollarsInputToCents(''), null);
    assert.equal(dollarsInputToCents('abc'), null);
    assert.equal(dollarsInputToCents('12abc'), 1200);
  });

  it('formats cents for the dollar input; null/undefined stay blank', () => {
    assert.equal(centsToDollarInput(9999), '99.99');
    assert.equal(centsToDollarInput(0), '0.00');
    assert.equal(centsToDollarInput(null), '');
    assert.equal(centsToDollarInput(undefined), '');
  });
});

describe('coerceQuickJobSavePayload', () => {
  it('uses || for color, !! for active, Number||0 for sort_order', () => {
    const payload = coerceQuickJobSavePayload({
      name: 'Align',
      color: '',
      is_active: 0,
      sort_order: '',
      items: [],
    });
    assert.equal(payload.color, null);
    assert.equal(payload.is_active, false);
    assert.equal(payload.sort_order, 0);
  });

  it('keeps negative sort_order (truthy Number) and maps empty qty string to 0', () => {
    const payload = coerceQuickJobSavePayload({
      name: 'Brake',
      color: 'red',
      is_active: 'yes',
      sort_order: -3,
      items: [
        { kind: 'part', quantity: '', unit_price_cents: '1999', discount_value: null },
        { kind: 'labor', quantity: null, unit_price_cents: undefined, discount_value: '5' },
      ],
    });
    assert.equal(payload.is_active, true);
    assert.equal(payload.sort_order, -3);
    assert.equal(payload.items[0].quantity, 0);
    assert.equal(payload.items[0].unit_price_cents, 1999);
    assert.equal(payload.items[0].discount_value, null);
    assert.equal(payload.items[1].quantity, null);
    assert.equal(payload.items[1].unit_price_cents, null);
    assert.equal(payload.items[1].discount_value, 5);
  });
});

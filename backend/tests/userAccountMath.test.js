import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceUserRole,
  coercePayRate,
  coerceSplitAmount,
  coerceSplitNotes,
  coerceSplitPeriod,
  isSelfDeactivation,
} from '../utils/userAccountMath.js';

describe('coerceUserRole', () => {
  it('promotes only the exact string admin', () => {
    assert.equal(coerceUserRole('admin'), 'admin');
  });

  it('coerces every other value to employee', () => {
    assert.equal(coerceUserRole('employee'), 'employee');
    assert.equal(coerceUserRole('Admin'), 'employee');
    assert.equal(coerceUserRole('ADMIN'), 'employee');
    assert.equal(coerceUserRole('administrator'), 'employee');
    assert.equal(coerceUserRole('master_admin'), 'employee');
    assert.equal(coerceUserRole(true), 'employee');
    assert.equal(coerceUserRole(1), 'employee');
    assert.equal(coerceUserRole(undefined), 'employee');
    assert.equal(coerceUserRole(null), 'employee');
    assert.equal(coerceUserRole(''), 'employee');
  });
});

describe('coercePayRate', () => {
  it('keeps positive rates including numeric strings', () => {
    assert.equal(coercePayRate(25), 25);
    assert.equal(coercePayRate(12.5), 12.5);
    assert.equal(coercePayRate('18'), '18');
  });

  it('collapses falsy values to 0 and keeps negatives', () => {
    assert.equal(coercePayRate(0), 0);
    assert.equal(coercePayRate(null), 0);
    assert.equal(coercePayRate(undefined), 0);
    assert.equal(coercePayRate(''), 0);
    assert.equal(coercePayRate(NaN), 0);
    assert.equal(coercePayRate(-5), -5);
  });
});

describe('coerceSplitAmount', () => {
  it('parses numeric strings and keeps negatives', () => {
    assert.equal(coerceSplitAmount('12.5'), 12.5);
    assert.equal(coerceSplitAmount(40), 40);
    assert.equal(coerceSplitAmount(-8), -8);
  });

  it('stores 0 for unparseable or falsy amounts', () => {
    assert.equal(coerceSplitAmount('abc'), 0);
    assert.equal(coerceSplitAmount(''), 0);
    assert.equal(coerceSplitAmount(null), 0);
    assert.equal(coerceSplitAmount(undefined), 0);
    assert.equal(coerceSplitAmount('0'), 0);
  });
});

describe('coerceSplitNotes', () => {
  it('trims notes and nulls empty or whitespace-only values', () => {
    assert.equal(coerceSplitNotes('  fuel  '), 'fuel');
    assert.equal(coerceSplitNotes(''), null);
    assert.equal(coerceSplitNotes('   '), null);
    assert.equal(coerceSplitNotes(null), null);
    assert.equal(coerceSplitNotes(undefined), null);
  });
});

describe('coerceSplitPeriod', () => {
  it('accepts only the exact string monthly', () => {
    assert.equal(coerceSplitPeriod('monthly'), 'monthly');
    assert.equal(coerceSplitPeriod('Monthly'), 'weekly');
    assert.equal(coerceSplitPeriod('MONTHLY'), 'weekly');
    assert.equal(coerceSplitPeriod('weekly'), 'weekly');
    assert.equal(coerceSplitPeriod('week'), 'weekly');
    assert.equal(coerceSplitPeriod(''), 'weekly');
    assert.equal(coerceSplitPeriod(undefined), 'weekly');
    assert.equal(coerceSplitPeriod(null), 'weekly');
  });
});

describe('isSelfDeactivation', () => {
  it('blocks when parseInt(target) strictly equals the actor id', () => {
    assert.equal(isSelfDeactivation(5, '5'), true);
    assert.equal(isSelfDeactivation(5, 5), true);
    assert.equal(isSelfDeactivation(5, '5abc'), true);
  });

  it('allows deactivating someone else, including string actor ids', () => {
    assert.equal(isSelfDeactivation(5, '6'), false);
    assert.equal(isSelfDeactivation(5, 'abc'), false);
    // parseInt('5') === '5' is false — string JWT ids would not trip the guard
    assert.equal(isSelfDeactivation('5', '5'), false);
  });
});

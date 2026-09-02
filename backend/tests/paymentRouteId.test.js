import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePaymentRouteId,
  parsePaymentMethodId,
  requirePaymentRouteId,
  requireCustomerAndPaymentMethod,
} from '../utils/paymentRouteId.js';

describe('parsePaymentRouteId', () => {
  it('rejects missing / 0 / NaN via !id || !Number.isFinite', () => {
    for (const raw of [undefined, null, '', 'abc', 'NaN', 0, '0', false]) {
      assert.deepEqual(parsePaymentRouteId(raw), { ok: false }, String(raw));
    }
  });

  it('accepts positive integers including string digits', () => {
    assert.deepEqual(parsePaymentRouteId(42), { ok: true, id: 42 });
    assert.deepEqual(parsePaymentRouteId('42'), { ok: true, id: 42 });
  });

  it('accepts negatives and non-integers (1.5) — only 0/NaN are rejected', () => {
    assert.deepEqual(parsePaymentRouteId(-3), { ok: true, id: -3 });
    assert.deepEqual(parsePaymentRouteId('-3'), { ok: true, id: -3 });
    assert.deepEqual(parsePaymentRouteId(1.5), { ok: true, id: 1.5 });
    assert.deepEqual(parsePaymentRouteId('1.5'), { ok: true, id: 1.5 });
  });

  it('treats whitespace-only as NaN (missing)', () => {
    assert.deepEqual(parsePaymentRouteId('   '), { ok: false });
  });
});

describe('parsePaymentMethodId', () => {
  it('treats falsy pmId as missing (0 / "" / null)', () => {
    assert.equal(parsePaymentMethodId(undefined), null);
    assert.equal(parsePaymentMethodId(null), null);
    assert.equal(parsePaymentMethodId(''), null);
    assert.equal(parsePaymentMethodId(0), null);
  });

  it('keeps string "0" and other truthy values as String(pmId)', () => {
    assert.equal(parsePaymentMethodId('0'), '0');
    assert.equal(parsePaymentMethodId('pm_abc'), 'pm_abc');
    assert.equal(parsePaymentMethodId(99), '99');
  });
});

describe('requirePaymentRouteId / requireCustomerAndPaymentMethod', () => {
  it('returns the invoice/customer missing error when id fails', () => {
    assert.deepEqual(requirePaymentRouteId(0, 'Invoice id is required'), {
      ok: false,
      error: 'Invoice id is required',
    });
    assert.deepEqual(requirePaymentRouteId('7', 'Invoice id is required'), {
      ok: true,
      id: 7,
    });
  });

  it('requires both a valid customer id and a truthy payment-method id', () => {
    assert.deepEqual(requireCustomerAndPaymentMethod(0, 'pm_1'), {
      ok: false,
      error: 'Customer id and payment method id are required',
    });
    assert.deepEqual(requireCustomerAndPaymentMethod(5, ''), {
      ok: false,
      error: 'Customer id and payment method id are required',
    });
    assert.deepEqual(requireCustomerAndPaymentMethod(5, 'pm_1'), {
      ok: true,
      crmCustomerId: 5,
      pmId: 'pm_1',
    });
  });
});

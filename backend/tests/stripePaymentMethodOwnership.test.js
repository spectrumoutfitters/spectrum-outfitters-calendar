import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentMethodBelongsToCustomer } from '../utils/stripePaymentMethodOwnership.js';

test('accepts PM attached to the expected Stripe customer (string customer)', () => {
  assert.equal(
    paymentMethodBelongsToCustomer({ id: 'pm_a', customer: 'cus_expected' }, 'cus_expected'),
    true
  );
});

test('accepts PM with expanded customer object', () => {
  assert.equal(
    paymentMethodBelongsToCustomer({ id: 'pm_a', customer: { id: 'cus_expected' } }, 'cus_expected'),
    true
  );
});

test('rejects PM attached to a different Stripe customer (cross-customer IDOR)', () => {
  assert.equal(
    paymentMethodBelongsToCustomer({ id: 'pm_victim', customer: 'cus_other' }, 'cus_expected'),
    false
  );
});

test('rejects unattached or missing customer', () => {
  assert.equal(paymentMethodBelongsToCustomer({ id: 'pm_a', customer: null }, 'cus_expected'), false);
  assert.equal(paymentMethodBelongsToCustomer({ id: 'pm_a' }, 'cus_expected'), false);
  assert.equal(paymentMethodBelongsToCustomer(null, 'cus_expected'), false);
  assert.equal(paymentMethodBelongsToCustomer({ id: 'pm_a', customer: 'cus_expected' }, ''), false);
  assert.equal(paymentMethodBelongsToCustomer({ id: 'pm_a', customer: 'cus_expected' }, null), false);
});

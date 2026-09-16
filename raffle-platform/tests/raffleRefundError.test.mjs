import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatRefundError } from '../src/lib/raffleRefundError.js';

describe('formatRefundError', () => {
  it('uses a generic message when the code is missing', () => {
    assert.equal(formatRefundError(undefined), 'Refund failed.');
    assert.equal(formatRefundError(''), 'Refund failed.');
  });

  it('maps auth and Stripe state codes', () => {
    assert.equal(formatRefundError('password_mismatch'), "Password didn't match the saved admin key.");
    assert.equal(formatRefundError('unauthorized'), 'Admin key was rejected.');
    assert.equal(formatRefundError('not_paid'), "Stripe says this session is not in 'paid' state.");
    assert.equal(formatRefundError('missing_session'), 'Stripe session id was missing on this row.');
    assert.equal(formatRefundError('stripe_not_configured'), 'STRIPE_SECRET_KEY is not set on the server.');
  });

  it('surfaces Stripe permission suffix and sheet-failed details', () => {
    assert.equal(
      formatRefundError('stripe_missing_refund_permission: Connect account cannot refund'),
      'Connect account cannot refund'
    );
    assert.equal(
      formatRefundError('stripe_missing_refund_permission'),
      'stripe_missing_refund_permission'
    );
    const sheet = formatRefundError('refund_done_but_sheet_failed: timeout');
    assert.match(sheet, /Stripe refund went through but the sheet did not update/);
    assert.match(sheet, /refund_done_but_sheet_failed: timeout/);
  });

  it('passes through unknown codes', () => {
    assert.equal(formatRefundError('already_refunded'), 'already_refunded');
  });
});

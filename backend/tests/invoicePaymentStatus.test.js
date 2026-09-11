import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { invoicePaymentStatus } from '../utils/invoicePaymentStatus.js';

describe('invoicePaymentStatus', () => {
  it('marks paid when paid covers a positive total', () => {
    assert.equal(invoicePaymentStatus(10000, 10000), 'paid');
    assert.equal(invoicePaymentStatus(10001, 10000), 'paid');
  });

  it('marks partial when some but not all of a positive total is paid', () => {
    assert.equal(invoicePaymentStatus(1, 10000), 'partial');
    assert.equal(invoicePaymentStatus(9999, 10000), 'partial');
  });

  it('marks unpaid when nothing is paid', () => {
    assert.equal(invoicePaymentStatus(0, 10000), 'unpaid');
    assert.equal(invoicePaymentStatus(0, 0), 'unpaid');
  });

  it('keeps $0 invoices with any paid amount as partial, not paid', () => {
    assert.equal(invoicePaymentStatus(1, 0), 'partial');
    assert.equal(invoicePaymentStatus(500, 0), 'partial');
  });

  it('treats negative paid as unpaid when it does not cover a positive total', () => {
    assert.equal(invoicePaymentStatus(-5, 100), 'unpaid');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceBookingCustomerName,
  coerceBookingCustomerPhone,
  coerceBookingCustomerEmail,
  bookingHoneypotTriggered,
  bookingSubmitFieldError,
} from '../utils/customerBookingSubmitGate.js';

describe('coerceBookingCustomerName', () => {
  it('trims and caps at 200; empty/null become empty string', () => {
    assert.equal(coerceBookingCustomerName('  Jane Doe  '), 'Jane Doe');
    assert.equal(coerceBookingCustomerName(null), '');
    assert.equal(coerceBookingCustomerName(undefined), '');
    assert.equal(coerceBookingCustomerName('A'.repeat(250)).length, 200);
  });
});

describe('coerceBookingCustomerPhone', () => {
  it('keeps digits, +, (), -, spaces; strips letters and other punctuation', () => {
    assert.equal(coerceBookingCustomerPhone(' (713) 555-0100 '), '(713) 555-0100');
    assert.equal(coerceBookingCustomerPhone('+1-713-555-0100 ext'), '+1-713-555-0100');
    assert.equal(coerceBookingCustomerPhone('call me!!'), '');
    assert.equal(coerceBookingCustomerPhone('1'.repeat(50)).length, 40);
  });
});

describe('coerceBookingCustomerEmail', () => {
  it('lowercases valid emails and rejects missing @ / domain / blank', () => {
    assert.equal(coerceBookingCustomerEmail('  Jane@Shop.COM  '), 'jane@shop.com');
    assert.equal(coerceBookingCustomerEmail('not-an-email'), null);
    assert.equal(coerceBookingCustomerEmail('a@b'), null);
    assert.equal(coerceBookingCustomerEmail(''), null);
    assert.equal(coerceBookingCustomerEmail(null), null);
  });
});

describe('bookingHoneypotTriggered', () => {
  it('treats company_website or website whitespace as spam; empty is ok', () => {
    assert.equal(bookingHoneypotTriggered({}), false);
    assert.equal(bookingHoneypotTriggered({ company_website: '   ' }), false);
    assert.equal(bookingHoneypotTriggered({ company_website: 'https://spam.test' }), true);
    assert.equal(bookingHoneypotTriggered({ website: 'bot' }), true);
    // Empty string is not nullish — company_website: '' shadows website and is not spam.
    assert.equal(bookingHoneypotTriggered({ company_website: '', website: 'x' }), false);
  });
});

describe('bookingSubmitFieldError', () => {
  const ok = { customer_name: 'Jane Doe', customer_phone: '7135550100' };

  it('rejects short names, short digit phones, then honeypot before passing', () => {
    assert.deepEqual(bookingSubmitFieldError({}), {
      code: 'validation',
      message: 'Please enter your name.',
    });
    assert.deepEqual(bookingSubmitFieldError({ customer_name: ' J ', customer_phone: '7135550100' }), {
      code: 'validation',
      message: 'Please enter your name.',
    });
    assert.deepEqual(bookingSubmitFieldError({ customer_name: 'Jane', customer_phone: '713-555' }), {
      code: 'validation',
      message: 'Please enter a valid phone number.',
    });
    assert.deepEqual(bookingSubmitFieldError({ ...ok, company_website: 'http://x' }), {
      code: 'spam',
      message: 'Spam blocked.',
    });
    assert.equal(bookingSubmitFieldError(ok), null);
    assert.equal(bookingSubmitFieldError({ ...ok, customer_phone: '(713) 555-0100' }), null);
  });
});

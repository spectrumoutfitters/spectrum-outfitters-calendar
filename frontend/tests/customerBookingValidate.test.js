import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { customerBookingFormError } from '../src/utils/customerBookingValidate.js';

describe('customerBookingFormError', () => {
  const ok = {
    customerName: 'Jane Doe',
    customerPhone: '(713) 555-0100',
    slotStartIso: '2026-09-10T13:00:00.000Z',
    config: { enabled: true },
  };

  it('rejects short/blank names before phone, slot, or enabled checks', () => {
    assert.equal(customerBookingFormError({ ...ok, customerName: '' }), 'Please enter your full name.');
    assert.equal(customerBookingFormError({ ...ok, customerName: '  J  ' }), 'Please enter your full name.');
    assert.equal(customerBookingFormError({ ...ok, customerName: '  Jo  ' }), null);
  });

  it('counts phone digits only; 6 digits fail, 7 pass', () => {
    assert.equal(
      customerBookingFormError({ ...ok, customerPhone: '713-555' }),
      'Please enter a valid phone number.'
    );
    assert.equal(customerBookingFormError({ ...ok, customerPhone: '713-5550' }), null);
    assert.equal(customerBookingFormError({ ...ok, customerPhone: 'abc' }), 'Please enter a valid phone number.');
  });

  it('requires a slot and config.enabled (missing config is unavailable)', () => {
    assert.equal(customerBookingFormError({ ...ok, slotStartIso: '' }), 'Pick a drop-off time.');
    assert.equal(customerBookingFormError({ ...ok, slotStartIso: null }), 'Pick a drop-off time.');
    assert.equal(customerBookingFormError({ ...ok, config: { enabled: false } }), 'Booking is not available.');
    assert.equal(customerBookingFormError({ ...ok, config: {} }), 'Booking is not available.');
    assert.equal(customerBookingFormError({ ...ok, config: null }), 'Booking is not available.');
    assert.equal(customerBookingFormError(ok), null);
  });
});

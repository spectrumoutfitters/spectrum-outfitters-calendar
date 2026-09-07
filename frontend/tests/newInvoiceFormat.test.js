import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  digitsOnly,
  formatPhoneUS,
  titleCase,
  vehicleLabel,
} from '../src/utils/newInvoiceFormat.js';

describe('titleCase', () => {
  it('trims, lowercases, and capitalizes the first char of each whitespace word', () => {
    assert.equal(titleCase('  JANE DOE  '), 'Jane Doe');
    assert.equal(titleCase('honda'), 'Honda');
    assert.equal(titleCase('CR-V SPORT'), 'Cr-v Sport');
    assert.equal(titleCase("o'brien"), "O'brien");
    assert.equal(titleCase(''), '');
    assert.equal(titleCase(null), '');
    assert.equal(titleCase(0), '');
  });
});

describe('digitsOnly / formatPhoneUS', () => {
  it('strips non-digits; formats 10 and +1 11; otherwise keeps original', () => {
    assert.equal(digitsOnly('(832) 555-1212'), '8325551212');
    assert.equal(digitsOnly(null), '');

    assert.equal(formatPhoneUS('8325551212'), '(832) 555-1212');
    assert.equal(formatPhoneUS('18325551212'), '+1 (832) 555-1212');
    assert.equal(formatPhoneUS('(832) 555-1212'), '(832) 555-1212');
    assert.equal(formatPhoneUS('5551212'), '5551212');
    assert.equal(formatPhoneUS('555-12'), '555-12');
    assert.equal(formatPhoneUS('28325551212'), '28325551212');
    assert.equal(formatPhoneUS('183255512120'), '183255512120');
    assert.equal(formatPhoneUS(null), '');
    assert.equal(formatPhoneUS(''), '');
  });
});

describe('vehicleLabel', () => {
  it('joins year/make/model; falls back to vin, plate, then em-dash', () => {
    assert.equal(vehicleLabel({ year: 2020, make: 'Honda', model: 'Civic' }), '2020 Honda Civic');
    assert.equal(vehicleLabel({ year: 0, make: 'Honda' }), 'Honda');
    assert.equal(vehicleLabel({ vin: '1HGBB' }), '1HGBB');
    assert.equal(vehicleLabel({ license_plate: 'ABC123' }), 'ABC123');
    assert.equal(vehicleLabel({}), '—');
    assert.equal(vehicleLabel(null), '—');
  });
});

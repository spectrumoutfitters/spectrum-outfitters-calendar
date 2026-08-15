import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizePhone, phonesEquivalent } from '../utils/raffleCanonicalPhone.js';

describe('canonicalizePhone', () => {
  it('strips punctuation to digits', () => {
    assert.equal(canonicalizePhone('(555) 123-4567'), '5551234567');
    assert.equal(canonicalizePhone('555-123-4567'), '5551234567');
    assert.equal(canonicalizePhone('555.123.4567'), '5551234567');
  });

  it('treats +1 / leading-1 11-digit US numbers as the same 10-digit identity', () => {
    assert.equal(canonicalizePhone('+1 (555) 123-4567'), '5551234567');
    assert.equal(canonicalizePhone('+15551234567'), '5551234567');
    assert.equal(canonicalizePhone('1-555-123-4567'), '5551234567');
    assert.equal(canonicalizePhone('15551234567'), '5551234567');
  });

  it('does not strip a leading 1 from a 10-digit number', () => {
    assert.equal(canonicalizePhone('1555123456'), '1555123456');
  });

  it('leaves non-11-digit international numbers intact', () => {
    assert.equal(canonicalizePhone('+44 20 7946 0958'), '442079460958');
    assert.equal(canonicalizePhone('555123456'), '555123456');
  });

  it('handles empty / null input', () => {
    assert.equal(canonicalizePhone(''), '');
    assert.equal(canonicalizePhone(null), '');
    assert.equal(canonicalizePhone(undefined), '');
  });
});

describe('phonesEquivalent', () => {
  it('matches 10-digit entry against +1 autofill of the same number', () => {
    assert.equal(phonesEquivalent('(555) 123-4567', '+1 (555) 123-4567'), true);
    assert.equal(phonesEquivalent('5551234567', '15551234567'), true);
  });

  it('does not match two different numbers', () => {
    assert.equal(phonesEquivalent('5551234567', '5551234568'), false);
    assert.equal(phonesEquivalent('5551234567', '15551234568'), false);
  });

  it('rejects short numbers even if they match after strip', () => {
    assert.equal(phonesEquivalent('5551234', '5551234'), false);
  });
});

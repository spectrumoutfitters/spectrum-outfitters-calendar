import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHours,
  sanitizeInput,
  toTitleCase,
  validateEmail
} from '../utils/helpers.js';

describe('calculateHours', () => {
  it('returns null when still clocked in', () => {
    assert.equal(calculateHours('2026-07-25T09:00:00.000Z', null), null);
  });

  it('computes elapsed hours minus break minutes', () => {
    const hours = calculateHours(
      '2026-07-25T09:00:00.000Z',
      '2026-07-25T17:30:00.000Z',
      30
    );
    assert.equal(hours, 8);
  });

  it('never returns negative hours when break exceeds elapsed time', () => {
    const hours = calculateHours(
      '2026-07-25T09:00:00.000Z',
      '2026-07-25T09:15:00.000Z',
      60
    );
    assert.equal(hours, 0);
  });

  it('defaults break minutes to zero', () => {
    const hours = calculateHours(
      '2026-07-25T09:00:00.000Z',
      '2026-07-25T10:00:00.000Z'
    );
    assert.equal(hours, 1);
  });
});

describe('sanitizeInput', () => {
  it('trims whitespace and strips angle brackets', () => {
    assert.equal(sanitizeInput('  <script>alert(1)</script>  '), 'scriptalert(1)/script');
  });

  it('passes through non-strings unchanged', () => {
    assert.equal(sanitizeInput(42), 42);
    assert.equal(sanitizeInput(null), null);
  });
});

describe('toTitleCase', () => {
  it('title-cases words', () => {
    assert.equal(toTitleCase('spectrum OUTFITTERS'), 'Spectrum Outfitters');
  });

  it('returns empty or non-string values unchanged', () => {
    assert.equal(toTitleCase(''), '');
    assert.equal(toTitleCase(null), null);
  });
});

describe('validateEmail', () => {
  it('accepts simple valid emails', () => {
    assert.equal(validateEmail('tech@spectrumoutfitters.com'), true);
  });

  it('rejects missing local/domain pieces and spaces', () => {
    assert.equal(validateEmail('not-an-email'), false);
    assert.equal(validateEmail('a@b'), false);
    assert.equal(validateEmail('a @b.com'), false);
  });
});

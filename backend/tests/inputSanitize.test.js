import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInput, toTitleCase, validateEmail } from '../utils/helpers.js';

describe('sanitizeInput', () => {
  it('trims whitespace and strips angle brackets', () => {
    assert.equal(sanitizeInput('  hello  '), 'hello');
    assert.equal(sanitizeInput('<script>alert(1)</script>'), 'scriptalert(1)/script');
    assert.equal(sanitizeInput('Ada <Lovelace>'), 'Ada Lovelace');
  });

  it('passes through non-strings unchanged', () => {
    assert.equal(sanitizeInput(12), 12);
    assert.equal(sanitizeInput(null), null);
    assert.equal(sanitizeInput(undefined), undefined);
    assert.deepEqual(sanitizeInput({ x: 1 }), { x: 1 });
  });
});

describe('toTitleCase', () => {
  it('lowercases then capitalizes word starts', () => {
    assert.equal(toTitleCase('ADA LOVELACE'), 'Ada Lovelace');
    assert.equal(toTitleCase('ada-lovelace'), 'Ada-Lovelace');
    assert.equal(toTitleCase('  jean luc  '), '  Jean Luc  ');
  });

  it('passes through empty or non-string values', () => {
    assert.equal(toTitleCase(''), '');
    assert.equal(toTitleCase(null), null);
    assert.equal(toTitleCase(undefined), undefined);
    assert.equal(toTitleCase(7), 7);
  });
});

describe('validateEmail', () => {
  it('accepts a simple local@domain.tld', () => {
    assert.equal(validateEmail('ada@example.com'), true);
    assert.equal(validateEmail('ada.lovelace+shop@example.co.uk'), true);
  });

  it('rejects missing @, missing TLD, and empty values', () => {
    assert.equal(validateEmail('ada'), false);
    assert.equal(validateEmail('ada@'), false);
    assert.equal(validateEmail('ada@example'), false);
    assert.equal(validateEmail('ada@example.'), false);
    assert.equal(validateEmail(''), false);
    assert.equal(validateEmail('   '), false);
  });
});

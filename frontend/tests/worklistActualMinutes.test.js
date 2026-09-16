import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coerceWorklistActualMinutes } from '../src/utils/worklistActualMinutes.js';

describe('coerceWorklistActualMinutes', () => {
  it('sends null when the field is empty or falsy', () => {
    assert.equal(coerceWorklistActualMinutes(''), null);
    assert.equal(coerceWorklistActualMinutes(null), null);
    assert.equal(coerceWorklistActualMinutes(undefined), null);
    assert.equal(coerceWorklistActualMinutes(0), null);
  });

  it('parses a numeric string, including zero', () => {
    assert.equal(coerceWorklistActualMinutes('45'), 45);
    assert.equal(coerceWorklistActualMinutes('0'), 0);
    assert.equal(coerceWorklistActualMinutes('45.9'), 45);
    assert.equal(coerceWorklistActualMinutes('45min'), 45);
  });

  it('yields NaN for non-numeric text (JSON body then stores null)', () => {
    assert.equal(Number.isNaN(coerceWorklistActualMinutes('abc')), true);
    assert.equal(Number.isNaN(coerceWorklistActualMinutes('   ')), true);
  });
});

import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { getCurrentCentralTimeString, toTitleCase } from '../src/utils/helpers.js';

describe('toTitleCase', () => {
  it('capitalizes each word, including after apostrophes and hyphens, without trimming', () => {
    assert.equal(toTitleCase('jane doe'), 'Jane Doe');
    assert.equal(toTitleCase("o'brien"), "O'Brien");
    assert.equal(toTitleCase('mary-jane'), 'Mary-Jane');
    assert.equal(toTitleCase('  mcdonald '), '  Mcdonald ');
    assert.equal(toTitleCase('CR-V'), 'Cr-V');
  });

  it('returns an empty string for missing values', () => {
    assert.equal(toTitleCase(''), '');
    assert.equal(toTitleCase(null), '');
    assert.equal(toTitleCase(undefined), '');
  });
});

describe('getCurrentCentralTimeString', () => {
  afterEach(() => {
    mock.timers.reset();
  });

  it('formats the shop clock in America/Chicago, including midnight and DST', () => {
    mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-07-15T05:00:00.000Z') });
    assert.match(getCurrentCentralTimeString(true), /^12:00\sAM$/);

    mock.timers.reset();
    mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-07-15T20:07:00.000Z') });
    assert.match(getCurrentCentralTimeString(true), /^3:07\sPM$/);

    mock.timers.reset();
    mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-01-15T18:05:00.000Z') });
    assert.match(getCurrentCentralTimeString(true), /^12:05\sPM$/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isArchivedQuery,
  coerceCreatePriority,
  isValidWorklistPriority,
  coerceWorklistTitleUpdate,
  toTitleCase,
  worklistProgress,
  nextWorklistToggle,
} from '../utils/worklistItemMath.js';

describe('isArchivedQuery', () => {
  it('accepts only exact string 1 or true', () => {
    assert.equal(isArchivedQuery('1'), true);
    assert.equal(isArchivedQuery('true'), true);
    assert.equal(isArchivedQuery(1), false);
    assert.equal(isArchivedQuery(true), false);
    assert.equal(isArchivedQuery('True'), false);
    assert.equal(isArchivedQuery('TRUE'), false);
    assert.equal(isArchivedQuery('yes'), false);
    assert.equal(isArchivedQuery('0'), false);
    assert.equal(isArchivedQuery(''), false);
    assert.equal(isArchivedQuery(undefined), false);
  });
});

describe('coerceCreatePriority / isValidWorklistPriority', () => {
  it('create falls back to medium; PUT only accepts the three exact values', () => {
    assert.equal(coerceCreatePriority('high'), 'high');
    assert.equal(coerceCreatePriority('medium'), 'medium');
    assert.equal(coerceCreatePriority('low'), 'low');
    assert.equal(coerceCreatePriority('HIGH'), 'medium');
    assert.equal(coerceCreatePriority('urgent'), 'medium');
    assert.equal(coerceCreatePriority(''), 'medium');
    assert.equal(coerceCreatePriority(undefined), 'medium');
    assert.equal(coerceCreatePriority(null), 'medium');

    assert.equal(isValidWorklistPriority('high'), true);
    assert.equal(isValidWorklistPriority('HIGH'), false);
    assert.equal(isValidWorklistPriority(undefined), false);
  });
});

describe('coerceWorklistTitleUpdate / toTitleCase', () => {
  it('ignores missing or whitespace titles and title-cases the rest', () => {
    assert.equal(coerceWorklistTitleUpdate(undefined), null);
    assert.equal(coerceWorklistTitleUpdate(''), null);
    assert.equal(coerceWorklistTitleUpdate('   '), null);
    assert.equal(coerceWorklistTitleUpdate('oil change'), 'Oil Change');
    assert.equal(coerceWorklistTitleUpdate('  OIL CHANGE  '), 'Oil Change');
    assert.equal(toTitleCase('brake job'), 'Brake Job');
    assert.equal(toTitleCase(''), '');
    assert.equal(toTitleCase(null), null);
  });
});

describe('worklistProgress', () => {
  it('uses strict is_completed === 1 and reports 100% when empty', () => {
    assert.deepEqual(worklistProgress([]), { total: 0, completed: 0, remaining: 0, progress: 100 });
    assert.deepEqual(worklistProgress(null), { total: 0, completed: 0, remaining: 0, progress: 100 });
    assert.deepEqual(
      worklistProgress([
        { is_completed: 1 },
        { is_completed: 0 },
        { is_completed: '1' },
        { is_completed: true },
      ]),
      { total: 4, completed: 1, remaining: 3, progress: 25 }
    );
    assert.deepEqual(
      worklistProgress([{ is_completed: 1 }, { is_completed: 1 }, { is_completed: 0 }]),
      { total: 3, completed: 2, remaining: 1, progress: 67 }
    );
  });
});

describe('nextWorklistToggle', () => {
  it('completes non-1 values and unchecking clears archive', () => {
    assert.deepEqual(nextWorklistToggle({ is_completed: 0, archived_at: '2026-01-01' }), {
      is_completed: 1,
      archived_at: '2026-01-01',
    });
    assert.deepEqual(nextWorklistToggle({ is_completed: 1, archived_at: '2026-01-01' }), {
      is_completed: 0,
      archived_at: null,
    });
    // string '1' is not === 1, so the row is treated as incomplete and gets completed
    assert.deepEqual(nextWorklistToggle({ is_completed: '1', archived_at: null }), {
      is_completed: 1,
      archived_at: null,
    });
  });
});

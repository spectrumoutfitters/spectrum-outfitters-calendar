import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatVacationDaysLabel, formatVacationTaskNote } from '../utils/vacationChecklistCopy.js';

describe('formatVacationDaysLabel', () => {
  it('maps numeric 0 to today and numeric 1 to tomorrow', () => {
    assert.equal(formatVacationDaysLabel(0), 'today');
    assert.equal(formatVacationDaysLabel(1), 'tomorrow');
  });

  it('does not treat string "0" / "1" as today / tomorrow (strict ===)', () => {
    assert.equal(formatVacationDaysLabel('0'), 'in 0 days');
    assert.equal(formatVacationDaysLabel('1'), 'in 1 days');
  });

  it('pluralizes other numbers, including negatives', () => {
    assert.equal(formatVacationDaysLabel(2), 'in 2 days');
    assert.equal(formatVacationDaysLabel(5), 'in 5 days');
    assert.equal(formatVacationDaysLabel(-1), 'in -1 days');
  });

  it('interpolates missing/undefined as "in undefined days"', () => {
    assert.equal(formatVacationDaysLabel(undefined), 'in undefined days');
    assert.equal(formatVacationDaysLabel(null), 'in null days');
  });
});

describe('formatVacationTaskNote', () => {
  it('omits the note unless taskCount > 0', () => {
    assert.equal(formatVacationTaskNote(0), '');
    assert.equal(formatVacationTaskNote(null), '');
    assert.equal(formatVacationTaskNote(undefined), '');
    assert.equal(formatVacationTaskNote(-1), '');
  });

  it('singular vs plural open-task copy', () => {
    assert.equal(formatVacationTaskNote(1), ' — they have 1 open task to hand off');
    assert.equal(formatVacationTaskNote(3), ' — they have 3 open tasks to hand off');
  });
});

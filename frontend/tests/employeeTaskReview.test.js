import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  checklistReadyForReview,
  completedPauseDurationMinutes,
  showSubmitForReviewPrompt,
  taskPausePayload,
  torqueConfirmationAccepted,
} from '../src/utils/employeeTaskReview.js';

describe('checklistReadyForReview', () => {
  it('requires a non-empty list and strict numeric completion', () => {
    assert.equal(checklistReadyForReview(undefined), false);
    assert.equal(checklistReadyForReview(null), false);
    assert.equal(checklistReadyForReview([]), false);
    assert.equal(checklistReadyForReview([{ is_completed: 1 }]), true);
    assert.equal(
      checklistReadyForReview([{ is_completed: 1 }, { is_completed: 0 }]),
      false,
    );
  });

  it('does not treat boolean true or string "1" as completed', () => {
    assert.equal(checklistReadyForReview([{ is_completed: true }]), false);
    assert.equal(checklistReadyForReview([{ is_completed: '1' }]), false);
  });
});

describe('showSubmitForReviewPrompt', () => {
  const done = [{ is_completed: 1 }, { is_completed: 1 }];

  it('shows the prompt only when every item is done and the task is still open', () => {
    assert.equal(showSubmitForReviewPrompt(done, 'in_progress'), true);
    assert.equal(showSubmitForReviewPrompt(done, 'todo'), true);
    assert.equal(showSubmitForReviewPrompt(done, 'review'), false);
    assert.equal(showSubmitForReviewPrompt(done, 'completed'), false);
  });

  it('hides the prompt when any checklist item is unfinished', () => {
    assert.equal(
      showSubmitForReviewPrompt([{ is_completed: 1 }, { is_completed: 0 }], 'in_progress'),
      false,
    );
    assert.equal(showSubmitForReviewPrompt([], 'in_progress'), false);
  });
});

describe('torqueConfirmationAccepted', () => {
  it('accepts a checked box and rejects an unchecked one', () => {
    assert.equal(torqueConfirmationAccepted(true), true);
    assert.equal(torqueConfirmationAccepted(false), false);
    assert.equal(torqueConfirmationAccepted(undefined), false);
    assert.equal(torqueConfirmationAccepted(0), false);
  });
});

describe('taskPausePayload', () => {
  it('trims the reason and drops blank notes', () => {
    assert.deepEqual(taskPausePayload('  Lunch  ', '   '), {
      reason: 'Lunch',
      notes: null,
    });
    assert.deepEqual(taskPausePayload('Pulled to another car', '  bay 2  '), {
      reason: 'Pulled to another car',
      notes: 'bay 2',
    });
  });

  it('rejects a missing or whitespace-only reason', () => {
    assert.equal(taskPausePayload('', 'note'), null);
    assert.equal(taskPausePayload('   ', 'note'), null);
    assert.equal(taskPausePayload(null, null), null);
  });
});

describe('completedPauseDurationMinutes', () => {
  it('rounds the wall-clock pause to the nearest minute', () => {
    assert.equal(
      completedPauseDurationMinutes('2026-07-26T12:00:00.000Z', '2026-07-26T12:30:00.000Z'),
      30,
    );
    assert.equal(
      completedPauseDurationMinutes('2026-07-26T12:00:00.000Z', '2026-07-26T12:00:30.000Z'),
      1,
    );
    assert.equal(
      completedPauseDurationMinutes('2026-07-26T12:00:00.000Z', '2026-07-26T12:00:20.000Z'),
      0,
    );
  });
});

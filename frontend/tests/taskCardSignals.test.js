import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  commentCountLabel,
  countCompletedSubtasks,
  taskCardActivity,
} from '../src/utils/taskCardSignals.js';

describe('countCompletedSubtasks', () => {
  it('counts only strict is_completed === 1', () => {
    const result = countCompletedSubtasks([
      { is_completed: 1 },
      { is_completed: 0 },
      { is_completed: true },
      { is_completed: '1' },
      {},
    ]);
    assert.deepEqual(result, { completed: 1, total: 5 });
  });

  it('treats a missing list as empty', () => {
    assert.deepEqual(countCompletedSubtasks(null), { completed: 0, total: 0 });
    assert.deepEqual(countCompletedSubtasks(undefined), { completed: 0, total: 0 });
  });
});

describe('commentCountLabel', () => {
  it('pluralizes every count except exactly one', () => {
    assert.equal(commentCountLabel(null), null);
    assert.equal(commentCountLabel([]), null);
    assert.equal(commentCountLabel([{}]), '1 comment');
    assert.equal(commentCountLabel([{}, {}]), '2 comments');
  });
});

describe('taskCardActivity', () => {
  it('shows Working only for an open in-progress task that is not paused', () => {
    assert.deepEqual(
      taskCardActivity({ status: 'in_progress', started_at: '2026-07-15T15:00:00.000Z' }),
      { needsReview: false, onPause: false, working: true },
    );
  });

  it('lets pause hide Working while review still shows', () => {
    assert.deepEqual(
      taskCardActivity({
        status: 'review',
        active_break: { id: 4 },
        started_at: '2026-07-15T15:00:00.000Z',
      }),
      { needsReview: true, onPause: true, working: false },
    );
  });

  it('does not show Working after completion or before start', () => {
    assert.equal(
      taskCardActivity({
        status: 'in_progress',
        started_at: '2026-07-15T15:00:00.000Z',
        completed_at: '2026-07-15T16:00:00.000Z',
      }).working,
      false,
    );
    assert.equal(
      taskCardActivity({ status: 'in_progress' }).working,
      false,
    );
    assert.equal(
      taskCardActivity({ status: 'todo', started_at: '2026-07-15T15:00:00.000Z' }).working,
      false,
    );
  });

  it('treats a missing task as idle', () => {
    assert.deepEqual(taskCardActivity(null), {
      needsReview: false,
      onPause: false,
      working: false,
    });
  });
});

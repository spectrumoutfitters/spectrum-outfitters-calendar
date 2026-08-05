import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDispatchStatus,
  computeDispatchProgress,
  computeElapsedMinutes,
} from '../utils/dispatchBoard.js';

describe('toDispatchStatus', () => {
  it('maps todo/in_progress/review to dispatch labels', () => {
    assert.equal(toDispatchStatus('todo'), 'received');
    assert.equal(toDispatchStatus('in_progress'), 'in_progress');
    assert.equal(toDispatchStatus('review'), 'ready');
  });

  it('passes through unknown statuses unchanged', () => {
    assert.equal(toDispatchStatus('completed'), 'completed');
    assert.equal(toDispatchStatus(null), null);
  });
});

describe('computeDispatchProgress', () => {
  it('prefers subtask completion percentage when subtasks exist', () => {
    assert.equal(
      computeDispatchProgress({ status: 'todo', subtask_count: 4, subtasks_done: 1 }),
      25
    );
    assert.equal(
      computeDispatchProgress({ status: 'in_progress', subtask_count: 2, subtasks_done: 2 }),
      100
    );
  });

  it('uses review / in_progress heuristics when no subtasks', () => {
    assert.equal(computeDispatchProgress({ status: 'review', subtask_count: 0 }), 90);
    assert.equal(computeDispatchProgress({ status: 'in_progress', subtask_count: 0 }), 25);
    assert.equal(computeDispatchProgress({ status: 'todo', subtask_count: 0 }), 0);
  });

  it('clamps elapsed/estimate progress between 25 and 85', () => {
    const started = '2026-08-05T10:00:00.000Z';
    const now = Date.parse('2026-08-05T10:30:00.000Z'); // 30 minutes

    // 30/60 → 50%
    assert.equal(
      computeDispatchProgress(
        {
          status: 'in_progress',
          subtask_count: 0,
          started_at: started,
          estimated_time_minutes: 60,
        },
        now
      ),
      50
    );

    // Very early → floor 25
    assert.equal(
      computeDispatchProgress(
        {
          status: 'in_progress',
          subtask_count: 0,
          started_at: started,
          estimated_time_minutes: 600,
        },
        now
      ),
      25
    );

    // Over estimate → cap 85
    assert.equal(
      computeDispatchProgress(
        {
          status: 'in_progress',
          subtask_count: 0,
          started_at: started,
          estimated_time_minutes: 10,
        },
        now
      ),
      85
    );
  });
});

describe('computeElapsedMinutes', () => {
  it('returns null when not started', () => {
    assert.equal(computeElapsedMinutes(null), null);
    assert.equal(computeElapsedMinutes(undefined), null);
  });

  it('floors elapsed minutes from started_at', () => {
    const started = '2026-08-05T10:00:00.000Z';
    const now = Date.parse('2026-08-05T10:09:59.000Z');
    assert.equal(computeElapsedMinutes(started, now), 9);
  });
});

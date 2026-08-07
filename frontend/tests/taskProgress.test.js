import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTaskProgress } from '../src/utils/taskProgress.js';

describe('calculateTaskProgress', () => {
  it('returns 100 for completed tasks', () => {
    assert.equal(calculateTaskProgress({ status: 'completed' }), 100);
  });

  it('returns 0 for untouched todo tasks', () => {
    assert.equal(calculateTaskProgress({ status: 'todo' }), 0);
    assert.equal(calculateTaskProgress({ status: 'pending' }), 0);
  });

  it('returns 25 for in_progress without started_at', () => {
    assert.equal(calculateTaskProgress({ status: 'in_progress' }), 25);
  });

  it('returns 90 for review without subtasks', () => {
    assert.equal(calculateTaskProgress({ status: 'review' }), 90);
  });

  it('returns 50 for started in_progress without estimate', () => {
    assert.equal(
      calculateTaskProgress({ status: 'in_progress', started_at: '2026-08-07T12:00:00.000Z' }),
      50
    );
  });

  it('clamps elapsed/estimate progress between 50 and 85', () => {
    const started = '2026-08-07T12:00:00.000Z';
    const now = new Date('2026-08-07T12:05:00.000Z'); // 5 of 60 min → ~8% → clamp 50
    assert.equal(
      calculateTaskProgress(
        { status: 'in_progress', started_at: started, estimated_time_minutes: 60 },
        now
      ),
      50
    );
    const mid = new Date('2026-08-07T12:40:00.000Z'); // 40/60 → ~67
    assert.equal(
      calculateTaskProgress(
        { status: 'in_progress', started_at: started, estimated_time_minutes: 60 },
        mid
      ),
      67
    );
    const late = new Date('2026-08-07T14:00:00.000Z'); // 120/60 → clamp 85
    assert.equal(
      calculateTaskProgress(
        { status: 'in_progress', started_at: started, estimated_time_minutes: 60 },
        late
      ),
      85
    );
  });

  it('uses subtask completion percent plus status bonus, capped at 100', () => {
    const half = {
      status: 'in_progress',
      started_at: '2026-08-07T12:00:00.000Z',
      subtasks: [
        { is_completed: 1 },
        { is_completed: 0 },
      ],
    };
    // 50% + 10 bonus = 60
    assert.equal(calculateTaskProgress(half), 60);

    const reviewAlmost = {
      status: 'review',
      subtasks: [
        { is_completed: 1 },
        { is_completed: 1 },
        { is_completed: 1 },
        { is_completed: 0 },
      ],
    };
    // 75% + 20 = 95
    assert.equal(calculateTaskProgress(reviewAlmost), 95);

    const allDoneReview = {
      status: 'review',
      subtasks: [{ is_completed: 1 }, { is_completed: 1 }],
    };
    // 100 + 20 → cap 100
    assert.equal(calculateTaskProgress(allDoneReview), 100);

    const inProgressNoStart = {
      status: 'in_progress',
      subtasks: [{ is_completed: 0 }, { is_completed: 0 }],
    };
    // 0% + 5 bonus
    assert.equal(calculateTaskProgress(inProgressNoStart), 5);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterWorklistItems, getDueTimeStatus } from '../src/utils/adminWorklistFilter.js';

const items = [
  { id: 1, priority: 'high', category: 'time_approval', is_completed: 0 },
  { id: 2, priority: 'high', category: 'task_review', is_completed: 1 },
  { id: 3, priority: 'low', category: 'time_approval', is_completed: true },
  { id: 4, priority: 'high', category: 'time_approval', is_completed: '1' },
];

describe('filterWorklistItems', () => {
  it('returns [] for non-arrays', () => {
    assert.deepEqual(filterWorklistItems(null, { status: 'pending' }), []);
  });

  it('pending drops only exact is_completed === 1 (true / "1" stay)', () => {
    const pending = filterWorklistItems(items, { priority: 'all', category: 'all', status: 'pending' });
    assert.deepEqual(pending.map((i) => i.id), [1, 3, 4]);
  });

  it('completed keeps only exact is_completed === 1', () => {
    const completed = filterWorklistItems(items, { priority: 'all', category: 'all', status: 'completed' });
    assert.deepEqual(completed.map((i) => i.id), [2]);
  });

  it('priority/category compare strictly; status all does not filter completion', () => {
    const highTime = filterWorklistItems(items, {
      priority: 'high',
      category: 'time_approval',
      status: 'all',
    });
    assert.deepEqual(highTime.map((i) => i.id), [1, 4]);
  });
});

describe('getDueTimeStatus', () => {
  const now = new Date('2026-09-03T15:00:00.000');

  it('returns null for falsy dueTime (including 0)', () => {
    assert.equal(getDueTimeStatus(null, now), null);
    assert.equal(getDueTimeStatus('', now), null);
    assert.equal(getDueTimeStatus(0, now), null);
  });

  it('buckets overdue / due-soon (< 60 min) / upcoming (60 min inclusive)', () => {
    assert.equal(getDueTimeStatus('14:59', now), 'overdue');
    assert.equal(getDueTimeStatus('15:00', now), 'due-soon');
    assert.equal(getDueTimeStatus('15:59', now), 'due-soon');
    assert.equal(getDueTimeStatus('16:00', now), 'upcoming');
  });

  it('invalid clock strings become upcoming (NaN diffs fail both < checks)', () => {
    assert.equal(getDueTimeStatus('abc', now), 'upcoming');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTaskUrgency } from '../src/utils/taskUrgency.js';

describe('getTaskUrgency', () => {
  const now = new Date('2026-08-08T15:30:00.000Z');

  it('returns none for completed tasks regardless of due date', () => {
    assert.equal(
      getTaskUrgency({ status: 'completed', due_date: '2026-08-01', priority: 'critical' }, now),
      'none'
    );
  });

  it('returns critical when due date is before today', () => {
    assert.equal(
      getTaskUrgency({ status: 'todo', due_date: '2026-08-07', priority: 'low' }, now),
      'critical'
    );
  });

  it('returns critical for critical priority even without due date', () => {
    assert.equal(getTaskUrgency({ status: 'in_progress', priority: 'Critical' }, now), 'critical');
  });

  it('returns high when due today', () => {
    assert.equal(
      getTaskUrgency({ status: 'todo', due_date: '2026-08-08', priority: 'low' }, now),
      'high'
    );
  });

  it('returns high for high priority before due-window medium', () => {
    assert.equal(
      getTaskUrgency({ status: 'todo', due_date: '2026-08-14', priority: 'high' }, now),
      'high'
    );
  });

  it('returns high when due within 2 days', () => {
    assert.equal(
      getTaskUrgency({ status: 'todo', due_date: '2026-08-10', priority: 'low' }, now),
      'high'
    );
  });

  it('returns medium when due within 7 days or medium priority', () => {
    assert.equal(
      getTaskUrgency({ status: 'todo', due_date: '2026-08-14', priority: 'low' }, now),
      'medium'
    );
    assert.equal(
      getTaskUrgency({ status: 'todo', due_date: '2026-09-01', priority: 'medium' }, now),
      'medium'
    );
  });

  it('returns low when far out with no elevated priority', () => {
    assert.equal(
      getTaskUrgency({ status: 'todo', due_date: '2026-09-01', priority: 'low' }, now),
      'low'
    );
    assert.equal(getTaskUrgency({ status: 'todo' }, now), 'low');
  });
});

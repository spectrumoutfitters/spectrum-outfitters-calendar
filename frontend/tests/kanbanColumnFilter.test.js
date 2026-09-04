import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterKanbanColumn,
  isKanbanDragBlocked,
  resolveKanbanDropStatus,
} from '../src/utils/kanbanColumnFilter.js';

const tasks = [
  { id: 1, status: 'todo', is_archived: 0, category: 'Tinting' },
  { id: 2, status: 'todo', is_archived: 1, category: 'Tinting' },
  { id: 3, status: 'in_progress', is_archived: true, category: 'PPF' },
  { id: 4, status: 'review', is_archived: '1', category: 'Wraps' },
  { id: 5, status: 'completed', is_archived: false, category: 'Tinting' },
  { id: 6, status: 'todo', category: 'PPF' },
];

describe('filterKanbanColumn', () => {
  it('archived column keeps only exact is_archived === 1', () => {
    const ids = filterKanbanColumn(tasks, 'archived').map((t) => t.id);
    assert.deepEqual(ids, [2]);
  });

  it('live columns hide numeric 1 and boolean true but keep string "1"', () => {
    assert.deepEqual(filterKanbanColumn(tasks, 'todo').map((t) => t.id), [1, 6]);
    assert.deepEqual(filterKanbanColumn(tasks, 'in_progress').map((t) => t.id), []);
    assert.deepEqual(filterKanbanColumn(tasks, 'review').map((t) => t.id), [4]);
    assert.deepEqual(filterKanbanColumn(tasks, 'completed').map((t) => t.id), [5]);
  });

  it('category filter is exact match and "all" is a no-op', () => {
    assert.deepEqual(filterKanbanColumn(tasks, 'todo', 'PPF').map((t) => t.id), [6]);
    assert.deepEqual(filterKanbanColumn(tasks, 'todo', 'all').map((t) => t.id), [1, 6]);
    assert.deepEqual(filterKanbanColumn(tasks, 'archived', 'Tinting').map((t) => t.id), [2]);
    assert.deepEqual(filterKanbanColumn(tasks, 'archived', 'PPF').map((t) => t.id), []);
  });

  it('non-array tasks yield an empty list', () => {
    assert.deepEqual(filterKanbanColumn(null, 'todo'), []);
    assert.deepEqual(filterKanbanColumn(undefined, 'archived'), []);
  });
});

describe('isKanbanDragBlocked', () => {
  it('blocks numeric 1 and boolean true only', () => {
    assert.equal(isKanbanDragBlocked({ is_archived: 1 }), true);
    assert.equal(isKanbanDragBlocked({ is_archived: true }), true);
    assert.equal(isKanbanDragBlocked({ is_archived: '1' }), false);
    assert.equal(isKanbanDragBlocked({ is_archived: 0 }), false);
    assert.equal(isKanbanDragBlocked({}), false);
    assert.equal(isKanbanDragBlocked(null), false);
  });
});

describe('resolveKanbanDropStatus', () => {
  it('maps live column ids to themselves', () => {
    assert.equal(resolveKanbanDropStatus('todo', tasks), 'todo');
    assert.equal(resolveKanbanDropStatus('review', tasks), 'review');
  });

  it('rejects archived column even when the archived lane is visible', () => {
    assert.equal(resolveKanbanDropStatus('archived', tasks, { showArchived: true }), null);
    assert.equal(resolveKanbanDropStatus('archived', tasks, { showArchived: false }), null);
  });

  it('uses the target task status when dropping on a card', () => {
    assert.equal(resolveKanbanDropStatus(5, tasks), 'completed');
    assert.equal(resolveKanbanDropStatus(99, tasks), null);
  });

  it('rejects a drop onto a task whose status is archived', () => {
    const withArchivedStatus = [...tasks, { id: 7, status: 'archived', is_archived: 0 }];
    assert.equal(resolveKanbanDropStatus(7, withArchivedStatus), null);
  });
});

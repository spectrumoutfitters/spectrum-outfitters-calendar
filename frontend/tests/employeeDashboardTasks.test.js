import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  compareEmployeeTaskStatus,
  isOpenEmployeeTask,
  selectEmployeeDashboardTasks,
} from '../src/utils/employeeDashboardTasks.js';

describe('isOpenEmployeeTask', () => {
  it('drops only exact status completed', () => {
    assert.equal(isOpenEmployeeTask({ status: 'completed' }), false);
    assert.equal(isOpenEmployeeTask({ status: 'Completed' }), true);
    assert.equal(isOpenEmployeeTask({ status: 'review' }), true);
    assert.equal(isOpenEmployeeTask({ status: 'todo' }), true);
    assert.equal(isOpenEmployeeTask({ status: 'in_progress' }), true);
    assert.equal(isOpenEmployeeTask({}), true);
  });

  it('hides any truthy is_archived, including string 0/1 (unlike Kanban === 1)', () => {
    assert.equal(isOpenEmployeeTask({ status: 'todo', is_archived: 0 }), true);
    assert.equal(isOpenEmployeeTask({ status: 'todo', is_archived: null }), true);
    assert.equal(isOpenEmployeeTask({ status: 'todo', is_archived: false }), true);
    assert.equal(isOpenEmployeeTask({ status: 'todo', is_archived: 1 }), false);
    assert.equal(isOpenEmployeeTask({ status: 'todo', is_archived: true }), false);
    assert.equal(isOpenEmployeeTask({ status: 'todo', is_archived: '1' }), false);
    assert.equal(isOpenEmployeeTask({ status: 'todo', is_archived: '0' }), false);
  });
});

describe('compareEmployeeTaskStatus', () => {
  it('orders in_progress, review, todo, then unknowns equally', () => {
    assert.equal(compareEmployeeTaskStatus({ status: 'in_progress' }, { status: 'review' }) < 0, true);
    assert.equal(compareEmployeeTaskStatus({ status: 'review' }, { status: 'todo' }) < 0, true);
    assert.equal(compareEmployeeTaskStatus({ status: 'todo' }, { status: 'blocked' }) < 0, true);
    assert.equal(compareEmployeeTaskStatus({ status: 'blocked' }, { status: 'other' }), 0);
    assert.equal(compareEmployeeTaskStatus({ status: 'COMPLETED' }, { status: 'todo' }) > 0, true);
  });
});

describe('selectEmployeeDashboardTasks', () => {
  it('filters then sorts; empty/null input is []', () => {
    assert.deepEqual(selectEmployeeDashboardTasks(null), []);
    assert.deepEqual(selectEmployeeDashboardTasks(undefined), []);

    const rows = [
      { id: 1, status: 'todo', is_archived: 0 },
      { id: 2, status: 'completed', is_archived: 0 },
      { id: 3, status: 'in_progress', is_archived: 0 },
      { id: 4, status: 'review', is_archived: 1 },
      { id: 5, status: 'review', is_archived: 0 },
      { id: 6, status: 'todo', is_archived: '1' },
    ];
    assert.deepEqual(
      selectEmployeeDashboardTasks(rows).map((t) => t.id),
      [3, 5, 1],
    );
  });
});

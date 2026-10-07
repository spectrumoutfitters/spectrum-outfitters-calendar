import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initialTasksTab, tasksTabForStatusFilter } from '../src/utils/tasksBoardTab.js';

describe('initialTasksTab', () => {
  it('opens the full board for admins and My Tasks for everyone else', () => {
    assert.equal(initialTasksTab(true), 'all');
    assert.equal(initialTasksTab(false), 'mine');
    assert.equal(initialTasksTab(undefined), 'mine');
  });
});

describe('tasksTabForStatusFilter', () => {
  it('moves to All Tasks when a status column is in the URL', () => {
    assert.equal(tasksTabForStatusFilter('review'), 'all');
    assert.equal(tasksTabForStatusFilter('in_progress'), 'all');
  });

  it('leaves the current tab alone when there is no status filter', () => {
    assert.equal(tasksTabForStatusFilter(null), null);
    assert.equal(tasksTabForStatusFilter(''), null);
    assert.equal(tasksTabForStatusFilter(undefined), null);
  });
});

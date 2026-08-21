import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAdminRole,
  isLegacyTaskAssociate,
  isAssignmentTableAssociate,
  canPutUpdateTask,
  canAssociateWithTask,
} from '../utils/taskAssociatePermission.js';

describe('isAdminRole', () => {
  it('only exact "admin" is admin', () => {
    assert.equal(isAdminRole('admin'), true);
    assert.equal(isAdminRole('Admin'), false);
    assert.equal(isAdminRole('ADMIN'), false);
    assert.equal(isAdminRole('employee'), false);
    assert.equal(isAdminRole(''), false);
    assert.equal(isAdminRole(null), false);
  });
});

describe('canPutUpdateTask vs canAssociateWithTask', () => {
  const employee = 7;
  const task = { assigned_to: 7, created_by: 99 };

  it('PUT denies creator/legacy assignee unless they appear in task_assignments', () => {
    assert.equal(canPutUpdateTask('employee', employee, []), false);
    assert.equal(canPutUpdateTask('employee', employee, [3, 4]), false);
    assert.equal(canPutUpdateTask('employee', employee, [7]), true);
    assert.equal(canPutUpdateTask('employee', employee, ['7']), false);
    assert.equal(canPutUpdateTask('admin', employee, []), true);
    assert.equal(canPutUpdateTask('Admin', employee, []), false);
  });

  it('start/status/checklist allow legacy assigned_to or created_by without assignment rows', () => {
    assert.equal(canAssociateWithTask('employee', 7, task, []), true);
    assert.equal(canAssociateWithTask('employee', 99, task, []), true);
    assert.equal(canAssociateWithTask('employee', 3, task, []), false);
    assert.equal(canAssociateWithTask('employee', 3, task, [3]), true);
    assert.equal(canAssociateWithTask('employee', 3, task, ['3']), false);
    assert.equal(canAssociateWithTask('admin', 3, task, []), true);
    assert.equal(canAssociateWithTask('employee', 0, { assigned_to: 0, created_by: 1 }, []), true);
  });

  it('legacy and assignment-table helpers match current === / some semantics', () => {
    assert.equal(isLegacyTaskAssociate(5, { assigned_to: 5, created_by: 1 }), true);
    assert.equal(isLegacyTaskAssociate(5, { assigned_to: '5', created_by: 1 }), false);
    assert.equal(isLegacyTaskAssociate(5, { assigned_to: 1, created_by: 5 }), true);
    assert.equal(isLegacyTaskAssociate(5, null), false);
    assert.equal(isAssignmentTableAssociate(5, [5, 6]), true);
    assert.equal(isAssignmentTableAssociate(5, [6]), false);
    assert.equal(isAssignmentTableAssociate(5, undefined), false);
  });
});

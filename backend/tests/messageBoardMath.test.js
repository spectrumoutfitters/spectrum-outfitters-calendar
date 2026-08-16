import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAdminRole,
  canAccessAdminBoard,
  canDeleteMessages,
  shouldIncludeAdminBoard,
  legacyTeamBoardType,
  resolveMessageDeleteNotify,
} from '../utils/messageBoardMath.js';

describe('isAdminRole / admin-board gates', () => {
  it('treats only the exact admin role as admin', () => {
    assert.equal(isAdminRole('admin'), true);
    assert.equal(canAccessAdminBoard('admin'), true);
    assert.equal(canDeleteMessages('admin'), true);
    assert.equal(shouldIncludeAdminBoard('admin'), true);

    for (const role of ['Admin', 'ADMIN', 'employee', 'manager', '', null, undefined, 0, false]) {
      assert.equal(isAdminRole(role), false, `isAdminRole(${JSON.stringify(role)})`);
      assert.equal(canAccessAdminBoard(role), false, `canAccessAdminBoard(${JSON.stringify(role)})`);
      assert.equal(canDeleteMessages(role), false, `canDeleteMessages(${JSON.stringify(role)})`);
      assert.equal(shouldIncludeAdminBoard(role), false, `shouldIncludeAdminBoard(${JSON.stringify(role)})`);
    }
  });
});

describe('legacyTeamBoardType', () => {
  it('routes exact admin to admin_board and everyone else to team_board', () => {
    assert.equal(legacyTeamBoardType('admin'), 'admin_board');
    assert.equal(legacyTeamBoardType('Admin'), 'team_board');
    assert.equal(legacyTeamBoardType('employee'), 'team_board');
    assert.equal(legacyTeamBoardType(undefined), 'team_board');
  });
});

describe('resolveMessageDeleteNotify', () => {
  it('sends admin_board team messages to the admin room', () => {
    assert.deepEqual(
      resolveMessageDeleteNotify({ is_team_message: 1, board_type: 'admin_board' }),
      { kind: 'board', room: 'admin', boardType: 'admin_board' }
    );
  });

  it('sends team_board and null/missing board_type to the team room', () => {
    assert.deepEqual(
      resolveMessageDeleteNotify({ is_team_message: 1, board_type: 'team_board' }),
      { kind: 'board', room: 'team', boardType: 'team_board' }
    );
    assert.deepEqual(
      resolveMessageDeleteNotify({ is_team_message: 1, board_type: null }),
      { kind: 'board', room: 'team', boardType: 'team_board' }
    );
    assert.deepEqual(
      resolveMessageDeleteNotify({ is_team_message: 1 }),
      { kind: 'board', room: 'team', boardType: 'team_board' }
    );
  });

  it('collapses unknown board types onto the team room with team_board payload', () => {
    assert.deepEqual(
      resolveMessageDeleteNotify({ is_team_message: 1, board_type: 'other' }),
      { kind: 'board', room: 'team', boardType: 'team_board' }
    );
  });

  it('treats non-numeric 1 team flags as private (strict === 1)', () => {
    assert.deepEqual(
      resolveMessageDeleteNotify({
        is_team_message: '1',
        board_type: 'admin_board',
        sender_id: 4,
        recipient_id: 9,
      }),
      { kind: 'private', senderId: 4, recipientId: 9 }
    );
    assert.deepEqual(
      resolveMessageDeleteNotify({ is_team_message: true, sender_id: 1, recipient_id: 2 }),
      { kind: 'private', senderId: 1, recipientId: 2 }
    );
    assert.deepEqual(
      resolveMessageDeleteNotify({ is_team_message: 0, sender_id: 1, recipient_id: 2 }),
      { kind: 'private', senderId: 1, recipientId: 2 }
    );
  });

  it('returns none for a missing message', () => {
    assert.deepEqual(resolveMessageDeleteNotify(null), { kind: 'none' });
    assert.deepEqual(resolveMessageDeleteNotify(undefined), { kind: 'none' });
  });
});

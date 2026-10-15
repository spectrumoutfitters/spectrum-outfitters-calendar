import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { incomingSocketAlert } from '../src/utils/socketIncomingAlert.js';

describe('incomingSocketAlert', () => {
  it('ignores the viewer’s own message even when that chat is not open', () => {
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 7, is_team_message: 0 }, 7, null),
      { action: 'ignore' },
    );
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 7, is_team_message: 1 }, 7, 'team_board'),
      { action: 'ignore' },
    );
    assert.deepEqual(
      incomingSocketAlert({ sender_id: '7', is_team_message: 0 }, 7, null),
      { action: 'alert', conversationId: '7' },
    );
  });

  it('alerts for a DM unless that exact sender id is the open conversation', () => {
    const dm = { sender_id: 7, is_team_message: 0, board_type: 'admin_board' };
    assert.deepEqual(incomingSocketAlert(dm, 3, null), { action: 'alert', conversationId: 7 });
    assert.deepEqual(incomingSocketAlert(dm, 3, 9), { action: 'alert', conversationId: 7 });
    assert.deepEqual(incomingSocketAlert(dm, 3, '7'), { action: 'alert', conversationId: 7 });
    assert.deepEqual(incomingSocketAlert(dm, 3, 7), { action: 'reload', conversationId: 7 });
    assert.deepEqual(incomingSocketAlert(dm, 3, 'admin_board'), { action: 'alert', conversationId: 7 });
  });

  it('collapses team traffic to admin_board or team_board and does not treat string flags as team', () => {
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 4, is_team_message: 1 }, 3, null),
      { action: 'alert', conversationId: 'team_board' },
    );
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 4, is_team_message: true, type: 'admin_board' }, 3, 'team_board'),
      { action: 'alert', conversationId: 'admin_board' },
    );
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 4, is_team_message: 1, board_type: 'admin_board', type: 'team_board' }, 3, 'admin_board'),
      { action: 'reload', conversationId: 'admin_board' },
    );
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 4, is_team_message: 1, board_type: 'custom' }, 3, 'team_board'),
      { action: 'reload', conversationId: 'team_board' },
    );
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 4, is_team_message: 1, board_type: '', type: '' }, 3, 'admin_board'),
      { action: 'alert', conversationId: 'team_board' },
    );
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 4, is_team_message: '1', board_type: 'admin_board' }, 3, 'admin_board'),
      { action: 'alert', conversationId: 4 },
    );
    assert.deepEqual(
      incomingSocketAlert({ sender_id: 4, is_team_message: 'true' }, 3, 'team_board'),
      { action: 'alert', conversationId: 4 },
    );
  });
});

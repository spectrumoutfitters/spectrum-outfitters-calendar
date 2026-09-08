import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  incomingMessageMatchesConversation,
  isTeamMessageFlag,
  resolveMessageBoardType,
  sentMessageMatchesConversation,
} from '../src/utils/chatTeamMessage.js';

describe('isTeamMessageFlag', () => {
  it('is exact === 1 or === true — sqlite-ish strings and 0 do not count', () => {
    assert.equal(isTeamMessageFlag(1), true);
    assert.equal(isTeamMessageFlag(true), true);
    assert.equal(isTeamMessageFlag('1'), false);
    assert.equal(isTeamMessageFlag('true'), false);
    assert.equal(isTeamMessageFlag(0), false);
    assert.equal(isTeamMessageFlag(false), false);
    assert.equal(isTeamMessageFlag(null), false);
  });
});

describe('resolveMessageBoardType', () => {
  it('prefers board_type, then type, then team_board only for a team flag', () => {
    assert.equal(resolveMessageBoardType({ board_type: 'admin_board', type: 'team_board', is_team_message: 1 }), 'admin_board');
    assert.equal(resolveMessageBoardType({ type: 'admin_board', is_team_message: 1 }), 'admin_board');
    assert.equal(resolveMessageBoardType({ is_team_message: 1 }), 'team_board');
    assert.equal(resolveMessageBoardType({ is_team_message: true }), 'team_board');
    assert.equal(resolveMessageBoardType({ is_team_message: '1' }), null);
    assert.equal(resolveMessageBoardType({ is_team_message: 0 }), null);
    assert.equal(resolveMessageBoardType({ board_type: '', type: '', is_team_message: 1 }), 'team_board');
  });
});

describe('incomingMessageMatchesConversation', () => {
  it('routes team/admin boards and DMs by sender or recipient; team flag blocks DM match', () => {
    const team = { id: 'team_board' };
    const admin = { id: 'admin_board' };
    const dm = { id: 7 };
    assert.equal(incomingMessageMatchesConversation({ is_team_message: 1 }, team), true);
    assert.equal(incomingMessageMatchesConversation({ board_type: 'admin_board' }, admin), true);
    assert.equal(incomingMessageMatchesConversation({ is_team_message: 1, sender_id: 7 }, dm), false);
    assert.equal(incomingMessageMatchesConversation({ is_team_message: 0, sender_id: 7 }, dm), true);
    assert.equal(incomingMessageMatchesConversation({ is_team_message: 0, recipient_id: 7 }, dm), true);
    assert.equal(incomingMessageMatchesConversation({ is_team_message: '1', sender_id: 7 }, dm), true);
    assert.equal(incomingMessageMatchesConversation({ is_team_message: 1 }, admin), false);
    assert.equal(incomingMessageMatchesConversation({ is_team_message: 1 }, null), false);
  });
});

describe('sentMessageMatchesConversation', () => {
  it('does not treat sender_id as the open DM (only recipient_id)', () => {
    const dm = { id: 7 };
    assert.equal(sentMessageMatchesConversation({ is_team_message: 0, sender_id: 7, recipient_id: 9 }, dm), false);
    assert.equal(sentMessageMatchesConversation({ is_team_message: 0, sender_id: 9, recipient_id: 7 }, dm), true);
    assert.equal(sentMessageMatchesConversation({ is_team_message: 1 }, { id: 'team_board' }), true);
  });
});

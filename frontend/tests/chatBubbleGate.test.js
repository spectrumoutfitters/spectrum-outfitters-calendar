import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chatBubbleShouldCountUnread, pickInitialChatConversation } from '../src/utils/chatBubbleGate.js';

describe('chatBubbleShouldCountUnread', () => {
  it('counts every message while the bubble is closed', () => {
    assert.equal(chatBubbleShouldCountUnread(false, 4, { sender_id: 4, is_team_message: 0 }), true);
  });

  it('does not count a DM that matches the open conversation id', () => {
    assert.equal(chatBubbleShouldCountUnread(true, 4, { sender_id: 4, is_team_message: 0 }), false);
  });

  it('counts a DM for a different sender, including a string/number id mismatch', () => {
    assert.equal(chatBubbleShouldCountUnread(true, 4, { sender_id: 9, is_team_message: false }), true);
    assert.equal(chatBubbleShouldCountUnread(true, '4', { sender_id: 4, is_team_message: 0 }), true);
  });

  it('treats any truthy team flag as the id "team", so the team_board thread still counts', () => {
    assert.equal(chatBubbleShouldCountUnread(true, 'team_board', { is_team_message: 1, sender_id: 2 }), true);
    assert.equal(chatBubbleShouldCountUnread(true, 'team_board', { is_team_message: '1', sender_id: 2 }), true);
    assert.equal(chatBubbleShouldCountUnread(true, 'team', { is_team_message: true, sender_id: 2 }), false);
  });
});

describe('pickInitialChatConversation', () => {
  it('opens the team board when it is present, even if it is not first', () => {
    const dm = { id: 3 };
    const admin = { id: 'admin_board' };
    const team = { id: 'team_board' };
    assert.equal(pickInitialChatConversation([dm, admin, team]), team);
  });

  it('falls back to the admin board, then the first conversation', () => {
    const admin = { id: 'admin_board' };
    const dm = { id: 8 };
    assert.equal(pickInitialChatConversation([dm, admin]), admin);
    assert.equal(pickInitialChatConversation([dm]), dm);
  });
});

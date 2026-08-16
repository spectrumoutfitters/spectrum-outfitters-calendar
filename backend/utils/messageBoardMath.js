/**
 * Message-board permission and delete-notify routing.
 * Wired into routes/messages.js — keep behavior identical.
 *
 * Admin checks are exact `'admin'` only (case-sensitive), matching the route.
 */

export function isAdminRole(role) {
  return role === 'admin';
}

export function canAccessAdminBoard(role) {
  return role === 'admin';
}

export function canDeleteMessages(role) {
  return role === 'admin';
}

export function shouldIncludeAdminBoard(role) {
  return role === 'admin';
}

/** Legacy GET /team: admins see admin_board; everyone else sees team_board. */
export function legacyTeamBoardType(role) {
  return role === 'admin' ? 'admin_board' : 'team_board';
}

/**
 * Where to emit `message_deleted`.
 * `is_team_message === 1` (strict number) is a board message; anything else is private.
 * Unknown/null board_type falls back to team_board. Only exact `'admin_board'` uses the admin room;
 * every other board type still notifies the team room with payload boardType `'team_board'`.
 */
export function resolveMessageDeleteNotify(message) {
  if (!message) return { kind: 'none' };
  if (message.is_team_message === 1) {
    const boardType = message.board_type || 'team_board';
    if (boardType === 'admin_board') {
      return { kind: 'board', room: 'admin', boardType: 'admin_board' };
    }
    return { kind: 'board', room: 'team', boardType: 'team_board' };
  }
  return {
    kind: 'private',
    senderId: message.sender_id,
    recipientId: message.recipient_id,
  };
}

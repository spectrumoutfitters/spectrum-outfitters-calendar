/**
 * Chat board routing: sqlite `is_team_message` is 1/true only (not '1' / '0').
 * Incoming DMs also match sender_id; sent confirmations only match recipient_id.
 */

export function isTeamMessageFlag(value) {
  return value === 1 || value === true;
}

export function resolveMessageBoardType(message) {
  const isTeam = isTeamMessageFlag(message?.is_team_message);
  return message?.board_type || message?.type || (isTeam ? 'team_board' : null);
}

export function incomingMessageMatchesConversation(message, currentConv) {
  const isTeamMessage = isTeamMessageFlag(message?.is_team_message);
  const messageBoardType = resolveMessageBoardType(message);
  return (
    (currentConv?.id === 'team_board' && messageBoardType === 'team_board') ||
    (currentConv?.id === 'admin_board' && messageBoardType === 'admin_board') ||
    (currentConv?.id === message?.sender_id && !isTeamMessage) ||
    (currentConv?.id === message?.recipient_id && !isTeamMessage)
  );
}

export function sentMessageMatchesConversation(message, currentConv) {
  const isTeamMessage = isTeamMessageFlag(message?.is_team_message);
  const messageBoardType = resolveMessageBoardType(message);
  return (
    (currentConv?.id === 'team_board' && messageBoardType === 'team_board') ||
    (currentConv?.id === 'admin_board' && messageBoardType === 'admin_board') ||
    (currentConv?.id === message?.recipient_id && !isTeamMessage)
  );
}

/**
 * Global socket alerts (sound + unread badge).
 *
 * Distinct from the open-chat matcher: DMs key off sender_id only, and any
 * team message whose board is not exactly `admin_board` collapses to
 * `team_board`. The team flag is only numeric 1 or boolean true.
 */

export function incomingSocketAlert(message, userId, viewingConversationId) {
  if (message.sender_id === userId) {
    return { action: 'ignore' };
  }

  const isTeamMessage = message.is_team_message === 1 || message.is_team_message === true;
  const messageBoardType = message.board_type || message.type || (isTeamMessage ? 'team_board' : null);
  const conversationId = isTeamMessage
    ? (messageBoardType === 'admin_board' ? 'admin_board' : 'team_board')
    : message.sender_id;

  if (viewingConversationId !== conversationId) {
    return { action: 'alert', conversationId };
  }
  return { action: 'reload', conversationId };
}

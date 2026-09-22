/**
 * Chat bubble unread + first-open conversation pick.
 * Team messages compare against the id "team" (truthy is_team_message),
 * which is separate from the team_board thread id used when opening chat.
 */

export function chatBubbleShouldCountUnread(isOpen, selectedConversationId, message) {
  if (!isOpen) return true;
  const comparedId = message.is_team_message ? 'team' : message.sender_id;
  return selectedConversationId !== comparedId;
}

export function pickInitialChatConversation(conversations) {
  const teamBoardConv = conversations.find((c) => c.id === 'team_board');
  const adminBoardConv = conversations.find((c) => c.id === 'admin_board');
  return teamBoardConv || adminBoardConv || conversations[0];
}

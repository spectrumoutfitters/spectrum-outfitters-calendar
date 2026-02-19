import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { formatDateTime, formatTime } from '../../utils/helpers';

const ChatWindow = ({ 
  onClose, 
  conversations, 
  selectedConversation, 
  onSelectConversation,
  onConversationsUpdate,
  newMessages,
  onNewMessageRead
}) => {
  const { socket, setViewingConversation } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Always ensure Team Board is available (everyone can see it)
  const teamBoardConv = conversations.find(c => c.id === 'team_board') || {
    id: 'team_board',
    name: 'Team Board',
    type: 'team_board',
    boardType: 'team_board',
    isTeam: true,
    unreadCount: 0
  };
  
  // Admin Board is only for admins
  const { isAdmin } = useAuth();
  const adminBoardConv = isAdmin 
    ? (conversations.find(c => c.id === 'admin_board') || {
        id: 'admin_board',
        name: 'Admin Board',
        type: 'admin_board',
        boardType: 'admin_board',
        isTeam: true,
        unreadCount: 0
      })
    : null;
  
  // Build conversation list: Team Board first, then Admin Board (if admin), then private conversations
  const allConversations = conversations.length > 0 
    ? conversations 
    : (adminBoardConv ? [teamBoardConv, adminBoardConv] : [teamBoardConv]);
  
  const currentConv = selectedConversation || allConversations[0];

  useEffect(() => {
    if (currentConv) {
      loadMessages();
      onSelectConversation(currentConv);
      // Notify SocketContext which conversation is being viewed
      if (setViewingConversation) {
        setViewingConversation(currentConv.id);
      }
    }
    return () => {
      if (setViewingConversation) {
        setViewingConversation(null);
      }
    };
  }, [currentConv?.id, setViewingConversation]);

  useEffect(() => {
    if (showUserList) {
      loadUsers();
    }
  }, [showUserList]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users/active');
      // Filter out current user
      setUsers(response.data.users.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = async (message) => {
      // Don't handle our own messages here (they're handled by message_sent)
      if (message.sender_id === user.id) return;
      
      const isTeamMessage = message.is_team_message === 1 || message.is_team_message === true;
      const messageBoardType = message.board_type || message.type || (isTeamMessage ? 'team_board' : null);
      
      if (
        (currentConv?.id === 'team_board' && messageBoardType === 'team_board') ||
        (currentConv?.id === 'admin_board' && messageBoardType === 'admin_board') ||
        (currentConv?.id === message.sender_id && !isTeamMessage) ||
        (currentConv?.id === message.recipient_id && !isTeamMessage)
      ) {
        // Check if message already exists (prevent duplicates)
        setMessages(prev => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            // Update existing message with new read receipts if available
            return prev.map(m => m.id === message.id ? { 
              ...m, 
              read_receipts: message.read_receipts !== undefined ? message.read_receipts : m.read_receipts, 
              read_count: message.read_count !== undefined ? message.read_count : m.read_count 
            } : m);
          }
          // Ensure new messages have read_receipts initialized
          return [...prev, {
            ...message,
            read_receipts: message.read_receipts || [],
            read_count: message.read_count || 0
          }];
        });
        scrollToBottom();
      }
      
      // Update conversations list when new message arrives
      if (onConversationsUpdate) {
        onConversationsUpdate();
      }
    };
    
    const handleMessageRead = async (messageId) => {
      // When viewing a conversation, mark messages as read
      // This is handled by the backend when loading messages, but we can also emit a read event
      // The backend already marks messages as read when fetching, so this is mainly for real-time updates
    };

    const handleMessageSent = (message) => {
      // Handle message sent confirmation - replace temp message with real one
      const isTeamMessage = message.is_team_message === 1 || message.is_team_message === true;
      const messageBoardType = message.board_type || message.type || (isTeamMessage ? 'team_board' : null);
      
      if (
        (currentConv?.id === 'team_board' && messageBoardType === 'team_board') ||
        (currentConv?.id === 'admin_board' && messageBoardType === 'admin_board') ||
        (currentConv?.id === message.recipient_id && !isTeamMessage)
      ) {
        setMessages(prev => {
          // Remove temp messages from current user with matching content
          const filtered = prev.filter(m => 
            !(m.isTemp && m.sender_id === user.id && m.message === message.message)
          );
          
          // Check if real message already exists
          const exists = filtered.some(m => m.id === message.id);
          if (exists) return filtered;
          
          // Add the real message
          return [...filtered, message];
        });
        scrollToBottom();
      }
      
      // Update conversations list
      if (onConversationsUpdate) {
        onConversationsUpdate();
      }
    };

    const handleTyping = (data) => {
      if (
        (currentConv?.id === 'team_board' && data.type === 'team_board') ||
        (currentConv?.id === 'admin_board' && data.type === 'admin_board') ||
        (currentConv?.id === data.userId && data.type === 'private')
      ) {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.userId);
          return [...filtered, { userId: data.userId, userName: data.userFullName }];
        });
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        }, 3000);
      }
    };

    const handleMessageDeleted = (data) => {
      // Check if this deletion is for the current conversation
      const messageBoardType = data.boardType;
      const isCurrentConv = 
        (currentConv?.id === 'team_board' && messageBoardType === 'team_board') ||
        (currentConv?.id === 'admin_board' && messageBoardType === 'admin_board') ||
        (!messageBoardType && currentConv?.id === 'team_board'); // Legacy messages
      
      if (isCurrentConv || !messageBoardType) {
        // Remove deleted message from the list
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
      }
      
      // Update conversations list
      if (onConversationsUpdate) {
        onConversationsUpdate();
      }
    };

    const handleReadReceiptUpdate = (data) => {
      // Update read receipts for a message
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, read_receipts: data.read_receipts || [], read_count: data.read_count || 0 }
          : msg
      ));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('user_typing', handleTyping);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('read_receipt_update', handleReadReceiptUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('user_typing', handleTyping);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('read_receipt_update', handleReadReceiptUpdate);
    };
  }, [socket, currentConv, onConversationsUpdate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!currentConv) return;
    try {
      let endpoint;
      if (currentConv.id === 'team_board') {
        endpoint = '/messages/team-board';
      } else if (currentConv.id === 'admin_board') {
        endpoint = '/messages/admin-board';
      } else if (currentConv.isTeam) {
        // Legacy fallback
        endpoint = '/messages/team';
      } else {
        endpoint = `/messages/private/${currentConv.id}`;
      }
      const response = await api.get(endpoint);
      setMessages(response.data.messages || []);
      scrollToBottom();
      
      // Reload unread count after marking messages as read
      if (onConversationsUpdate) {
        onConversationsUpdate();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || !socket || !currentConv) return;

    const message = inputMessage.trim();
    setInputMessage('');

    // Store temp message ID to replace it later
    const tempMessageId = `temp_${Date.now()}`;
    const tempMessage = {
      id: tempMessageId, // Temporary ID
      message: message,
      sender_id: user.id,
      sender_name: user.full_name || user.username,
      created_at: new Date().toISOString(),
      is_team_message: currentConv.isTeam ? 1 : 0,
      isTemp: true // Flag to identify temp messages
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      if (currentConv.id === 'team_board') {
        socket.emit('team_board_message', { message });
      } else if (currentConv.id === 'admin_board') {
        socket.emit('admin_board_message', { message });
      } else if (currentConv.isTeam) {
        // Legacy fallback
        socket.emit('team_message', { message });
      } else {
        socket.emit('private_message', { recipientId: currentConv.id, message });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
    }

    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onConversationsUpdate();
  };

  const handleDeleteMessage = async (messageId) => {
    if (!isAdmin) return;
    
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      await api.delete(`/messages/${messageId}`);
      // Message will be removed via socket event
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete message');
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      if (currentConv?.id === 'team_board') {
        socket?.emit('typing', { type: 'team_board' });
      } else if (currentConv?.id === 'admin_board') {
        socket?.emit('typing', { type: 'admin_board' });
      } else if (currentConv?.isTeam) {
        socket?.emit('typing', { type: 'team' });
      } else {
        socket?.emit('typing', { type: 'private', recipientId: currentConv?.id });
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleStartConversation = (selectedUser) => {
    // Check if conversation already exists
    const existingConv = conversations.find(c => c.id === selectedUser.id);
    if (existingConv) {
      onSelectConversation(existingConv);
    } else {
      // Create new conversation object
      const newConv = {
        id: selectedUser.id,
        name: selectedUser.full_name,
        username: selectedUser.username,
        type: 'private',
        isTeam: false,
        unreadCount: 0
      };
      onSelectConversation(newConv);
    }
    setShowUserList(false);
    setSearchQuery('');
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render message with @mentions highlighted
  const renderMessageWithMentions = (text) => {
    if (!text) return '';
    const parts = [];
    const mentionRegex = /@(\w+)/g;
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Add highlighted mention
      parts.push(
        <span key={match.index} className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">
          @{match[1]}
        </span>
      );
      lastIndex = mentionRegex.lastIndex;
    }
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Render read receipts
  const renderReadReceipts = (message, conversation) => {
    if (!message.read_receipts || message.read_receipts.length === 0) {
      // No one has read it yet
      return (
        <span className="text-xs opacity-50" title="Not read yet">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
        </span>
      );
    }

    const isTeamMessage = conversation?.isTeam || conversation?.id === 'team_board' || conversation?.id === 'admin_board';
    
    if (isTeamMessage) {
      // For team messages, show count of readers
      const readCount = message.read_count || message.read_receipts.length;
      return (
        <span className="text-xs flex items-center gap-1" title={`Read by ${readCount} ${readCount === 1 ? 'person' : 'people'}`}>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>{readCount}</span>
        </span>
      );
    } else {
      // For private messages, show double checkmark if read
      const isRead = message.read_receipts.some(r => r.user_id !== user.id);
      if (isRead) {
        return (
          <span className="text-xs" title="Read">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        );
      } else {
        return (
          <span className="text-xs opacity-50" title="Delivered">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[800px] md:h-[700px] md:rounded-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-white p-3 md:p-4 flex justify-between items-center flex-shrink-0">
        <h3 className="font-semibold text-base md:text-lg">Messages</h3>
        <button onClick={onClose} className="text-white hover:text-gray-200 p-1 active:opacity-70" aria-label="Close chat">
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations Sidebar */}
        <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-gray-200 flex-col`}>
          {/* New Message Button */}
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              + New Message
            </button>
          </div>

          {/* User List (when creating new message) */}
          {showUserList && (
            <div className="border-b border-gray-200 p-2">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="max-h-40 overflow-y-auto mt-2">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleStartConversation(u)}
                    className="p-2 hover:bg-gray-100 rounded cursor-pointer text-sm"
                  >
                    <div className="font-medium">{u.full_name}</div>
                    <div className="text-xs text-gray-500">@{u.username}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {allConversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                <p>No conversations yet</p>
                <p className="text-xs mt-2">Start a conversation!</p>
              </div>
            ) : (
              allConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 ${
                    currentConv?.id === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{conv.name}</div>
                      {conv.lastMessage && (
                        <p className="text-xs text-gray-600 truncate mt-1">
                          {conv.lastMessage.message}
                        </p>
                      )}
                      {conv.lastMessage && (
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(conv.lastMessage.created_at)}
                        </p>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-2 flex-shrink-0">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {currentConv ? (
            <>
              {/* Conversation Header */}
              <div className="p-3 md:p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectConversation(null)}
                      className="md:hidden text-gray-600 hover:text-gray-800 p-1"
                      aria-label="Back to conversations"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h4 className="font-semibold text-sm md:text-base truncate">{currentConv.name}</h4>
                  </div>
                  {currentConv.isTeam && (
                    <p className="text-xs md:text-sm text-gray-500">Team conversation</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <p className="text-lg font-medium mb-2">No messages yet</p>
                      <p className="text-sm">Be the first to send a message!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'} group`}
                    >
                      <div className="relative">
                        <div
                          className={`max-w-[85%] md:max-w-[70%] rounded-lg p-2 md:p-3 text-sm md:text-base ${
                            msg.sender_id === user.id
                              ? 'bg-primary text-white'
                              : 'bg-gray-200 text-gray-800'
                          }`}
                        >
                          {msg.sender_id !== user.id && (
                            <p className="text-xs font-semibold mb-1">{msg.sender_name}</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {renderMessageWithMentions(msg.message)}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className={`text-xs ${msg.sender_id === user.id ? 'text-blue-100' : 'text-gray-500'}`}>
                              {formatTime(msg.created_at)}
                            </p>
                            {/* Read Receipts */}
                            {msg.sender_id === user.id && (
                              <div className="flex items-center gap-1 ml-2">
                                {renderReadReceipts(msg, currentConv)}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Delete button - only visible to admins on hover */}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title="Delete message"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {typingUsers.length > 0 && (
                  <div className="text-sm text-gray-500 italic">
                    {typingUsers.map(u => u.userName).join(', ')} typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t p-3 md:p-4 flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  />
                  <button
                    onClick={handleSend}
                    className="px-4 md:px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition text-sm md:text-base active:scale-95 min-w-[60px]"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import ChatWindow from './ChatWindow';
import api from '../../utils/api';

const ChatBubble = ({ stacked = false }) => {
  const { socket, unreadCount, setUnreadCount, playNotificationSound } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessages, setNewMessages] = useState([]);
  const hasAutoSelectedOnce = useRef(false);

  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleNewMessage = (message) => {
      setNewMessages(prev => [...prev, message]);
      // Sound is handled globally in SocketContext, just update unread count if needed
      if (!isOpen || selectedConversation?.id !== (message.is_team_message ? 'team' : message.sender_id)) {
        setUnreadCount(prev => prev + 1);
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, isOpen, selectedConversation, setUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
      // Reload unread count when opening chat
      const updateUnreadCount = async () => {
        try {
          const response = await api.get('/messages/unread-count');
          setUnreadCount(response.data.totalUnread || 0);
        } catch (error) {
          console.error('Error loading unread count:', error);
        }
      };
      updateUnreadCount();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    try {
      const response = await api.get('/messages/conversations');
      setConversations(response.data.conversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleConversationSelect = async (conversation) => {
    setSelectedConversation(conversation);
    
    // Reload conversations to get updated unread counts after viewing
    await loadConversations();
    
    // Update unread count from server
    try {
      const response = await api.get('/messages/unread-count');
      setUnreadCount(response.data.totalUnread || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  // Auto-select first conversation only once when chat opens (so Back doesn’t re-select)
  useEffect(() => {
    if (!isOpen) {
      hasAutoSelectedOnce.current = false;
      return;
    }
    if (conversations.length > 0 && !selectedConversation && !hasAutoSelectedOnce.current) {
      const teamBoardConv = conversations.find(c => c.id === 'team_board');
      const adminBoardConv = conversations.find(c => c.id === 'admin_board');
      setSelectedConversation(teamBoardConv || adminBoardConv || conversations[0]);
      hasAutoSelectedOnce.current = true;
    }
  }, [isOpen, conversations, selectedConversation]);

  const chatButton = (
    <button
      onClick={() => setIsOpen(true)}
      className="bg-primary text-white rounded-full p-3 md:p-4 shadow-lg hover:bg-blue-700 transition relative active:scale-95 flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center"
      aria-label="Open chat"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );

  if (!isOpen) {
    if (stacked) return chatButton;
    return (
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
        {chatButton}
      </div>
    );
  }

  return (
    <ChatWindow
      onClose={() => setIsOpen(false)}
      conversations={conversations}
      selectedConversation={selectedConversation}
      onSelectConversation={handleConversationSelect}
      onConversationsUpdate={loadConversations}
      newMessages={newMessages}
      onNewMessageRead={() => setNewMessages([])}
    />
  );
};

export default ChatBubble;


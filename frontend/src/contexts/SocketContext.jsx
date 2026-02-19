import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationSoundRef = useRef(null);
  const viewingConversationRef = useRef(null); // Track which conversation is being viewed

  // Create notification sound function
  const playNotificationSound = () => {
    if (notificationSoundRef.current) {
      try {
        notificationSoundRef.current.play();
      } catch (err) {
        console.error('Error playing notification sound:', err);
      }
    }
  };

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // Create notification sound using Web Audio API (text message-like sound)
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      notificationSoundRef.current = {
        play: () => {
          // Text message-like two-tone chime
          const playTone = (frequency, startTime, duration) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
          };
          
          const now = audioContext.currentTime;
          // First tone (higher)
          playTone(800, now, 0.1);
          // Second tone (lower) - slight delay
          playTone(600, now + 0.1, 0.15);
        }
      };
    } catch (e) {
      console.warn('Web Audio API not supported, notifications will be silent');
    }

        // Use same origin so Vite proxy can forward (avoids mixed content when frontend is HTTPS)
        const socketUrl = import.meta.env.VITE_API_URL
          ? new URL(import.meta.env.VITE_API_URL).origin
          : window.location.origin;
        const newSocket = io(socketUrl, {
          path: '/socket.io',
          auth: { token },
          transports: ['websocket', 'polling']
        });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  // Listen for new messages globally and play sound
  useEffect(() => {
    if (!socket || !user) return;

    const handleGlobalNewMessage = async (message) => {
      // Don't play sound for your own messages
      if (message.sender_id === user.id) return;
      
      const isTeamMessage = message.is_team_message === 1 || message.is_team_message === true;
      const messageBoardType = message.board_type || message.type || (isTeamMessage ? 'team_board' : null);
      const messageConversationId = isTeamMessage 
        ? (messageBoardType === 'admin_board' ? 'admin_board' : 'team_board')
        : message.sender_id;
      
      // Only play sound if not viewing this conversation
      if (viewingConversationRef.current !== messageConversationId) {
        playNotificationSound();
        // Update unread count
        setUnreadCount(prev => prev + 1);
      } else {
        // If viewing the conversation, reload unread count from server to ensure accuracy
        try {
          const response = await api.get('/messages/unread-count');
          setUnreadCount(response.data.totalUnread || 0);
        } catch (error) {
          console.error('Error loading unread count:', error);
        }
      }
    };

    const handleMentionNotification = (notification) => {
      // Hard notification for @mentions - always play sound and show alert
      playNotificationSound();
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`@${user.username} mentioned`, {
          body: `${notification.senderName}: ${notification.message.substring(0, 100)}${notification.message.length > 100 ? '...' : ''}`,
          icon: '/spectrum-icon.png'
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        // Request permission
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(`@${user.username} mentioned`, {
              body: `${notification.senderName}: ${notification.message.substring(0, 100)}${notification.message.length > 100 ? '...' : ''}`,
              icon: '/spectrum-icon.png'
            });
          }
        });
      }
      
      // Show alert as fallback
      alert(`🔔 You were mentioned by ${notification.senderName}!\n\n"${notification.message.substring(0, 200)}${notification.message.length > 200 ? '...' : ''}"`);
      
      // Update unread count
      setUnreadCount(prev => prev + 1);
    };

    socket.on('new_message', handleGlobalNewMessage);
    socket.on('mention_notification', handleMentionNotification);

    return () => {
      socket.off('new_message', handleGlobalNewMessage);
      socket.off('mention_notification', handleMentionNotification);
    };
  }, [socket, user, setUnreadCount]);

  // Load unread count periodically
  useEffect(() => {
    if (!user) return;

    const loadUnreadCount = async () => {
      try {
        const response = await api.get('/messages/unread-count');
        setUnreadCount(response.data.totalUnread || 0);
      } catch (error) {
        console.error('Error loading unread count:', error);
      }
    };

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  const value = {
    socket,
    isConnected,
    unreadCount,
    setUnreadCount,
    playNotificationSound,
    setViewingConversation: (convId) => {
      viewingConversationRef.current = convId;
    }
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};


import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import UpdatesModal from './UpdatesModal';
import { formatUnreadBadgeCount, shouldAutoShowUpdates } from '../../utils/updatesBadgeGate';

const UpdatesBadge = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkUnreadUpdates();
    // Check every 5 minutes for new updates
    const interval = setInterval(checkUnreadUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkUnreadUpdates = async () => {
    try {
      const response = await api.get('/updates/unread');
      setUnreadCount(response.data.unreadCount || 0);
      
      if (!showModal && shouldAutoShowUpdates({
        unreadCount: response.data.unreadCount,
        lastShownAt: localStorage.getItem('updates_last_shown'),
      })) {
        setShowModal(true);
        localStorage.setItem('updates_last_shown', Date.now().toString());
      }
    } catch (error) {
      console.error('Error checking unread updates:', error);
    }
  };

  const handleMarkAllRead = () => {
    setUnreadCount(0);
  };

  if (unreadCount === 0 && !showModal) {
    return null;
  }

  return (
    <>
      {/* Badge button */}
      {unreadCount > 0 && (
        <button
          onClick={() => setShowModal(true)}
          className="relative inline-flex items-center px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition shadow-md"
          title="View system updates"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {formatUnreadBadgeCount(unreadCount)}
            </span>
          )}
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <UpdatesModal
          onClose={() => {
            setShowModal(false);
            checkUnreadUpdates(); // Refresh count after closing
          }}
          onMarkAllRead={handleMarkAllRead}
        />
      )}
    </>
  );
};

export default UpdatesBadge;

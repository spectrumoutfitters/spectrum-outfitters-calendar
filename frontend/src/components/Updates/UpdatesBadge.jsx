import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import UpdatesModal from './UpdatesModal';

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
      
      // Auto-show modal if there are unread updates and modal isn't already showing
      if (response.data.unreadCount > 0 && !showModal) {
        // Only auto-show once per session (check localStorage)
        const lastShown = localStorage.getItem('updates_last_shown');
        const now = Date.now();
        // Show if never shown before, or if it's been more than 1 hour since last show
        if (!lastShown || (now - parseInt(lastShown)) > 60 * 60 * 1000) {
          setShowModal(true);
          localStorage.setItem('updates_last_shown', now.toString());
        }
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
              {unreadCount > 9 ? '9+' : unreadCount}
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

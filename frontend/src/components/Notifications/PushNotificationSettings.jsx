import React, { useState } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

const PushNotificationSettings = () => {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { isAdmin } = useAuth();
  const [testStatus, setTestStatus] = useState('');

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        setTestStatus('');
      } else {
        await subscribe();
        setTestStatus('');
      }
    } catch (err) {
      setTestStatus(err.message || 'Failed to update notification settings');
    }
  };

  const handleTest = async () => {
    setTestStatus('Sending…');
    try {
      await api.post('/push/test');
      setTestStatus('Test notification sent!');
      setTimeout(() => setTestStatus(''), 3000);
    } catch {
      setTestStatus('Failed to send test notification');
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-6">
        <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-neutral-100">Push Notifications</h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400">
          Push notifications are not supported on this browser. Requires iOS 16.4+ Safari or a modern desktop browser.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-6">
      <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-neutral-100">Push Notifications</h2>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mb-4">
        Receive notifications even when the app is in the background or closed.
      </p>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-neutral-200">
            {isSubscribed ? 'Notifications enabled' : 'Notifications disabled'}
          </p>
          {isSubscribed && (
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
              You&apos;ll receive alerts for new tasks, approvals, and announcements
            </p>
          )}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isSubscribed}
            onChange={handleToggle}
            disabled={isLoading}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-neutral-200 after:border-gray-300 dark:after:border-neutral-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
        </label>
      </div>

      {isSubscribed && isAdmin && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 text-sm rounded-lg transition disabled:opacity-50"
          >
            Send Test
          </button>
          {testStatus && (
            <span className="text-sm text-gray-600 dark:text-neutral-400">{testStatus}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default PushNotificationSettings;

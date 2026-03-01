import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import api from '../../utils/api';

const PushNotificationSettings = () => {
  const { isAdmin } = useAuth();
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const [testStatus, setTestStatus] = useState('');

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleTest = async () => {
    try {
      setTestStatus('sending');
      await api.post('/push/test');
      setTestStatus('sent');
      setTimeout(() => setTestStatus(''), 3000);
    } catch {
      setTestStatus('error');
      setTimeout(() => setTestStatus(''), 3000);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md border border-transparent dark:border-neutral-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-neutral-100">Push Notifications</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-neutral-100">
              Enable Push Notifications
            </label>
            <p className="text-xs text-gray-500 dark:text-neutral-100 mt-1">
              Receive alerts even when the app is in the background
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSubscribed}
                onChange={handleToggle}
                disabled={isLoading}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-neutral-200 after:border-gray-300 dark:after:border-neutral-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        {isAdmin && isSubscribed && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-neutral-700">
            <button
              onClick={handleTest}
              disabled={testStatus === 'sending'}
              className="px-4 py-2 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-neutral-100 text-sm rounded-lg transition disabled:opacity-50"
            >
              {testStatus === 'sending' ? 'Sending...' : 'Send Test Notification'}
            </button>
            {testStatus === 'sent' && (
              <span className="text-sm text-green-600 dark:text-green-400">Test sent!</span>
            )}
            {testStatus === 'error' && (
              <span className="text-sm text-red-600 dark:text-red-400">Failed to send</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PushNotificationSettings;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import PushNotificationSettings from '../components/Notifications/PushNotificationSettings';

const Profile = () => {
  const { user, isAdmin, refreshUser } = useAuth();
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [usernameData, setUsernameData] = useState({
    newUsername: user?.username || ''
  });
  const [showClockInHeader, setShowClockInHeader] = useState(user?.show_clock_in_header !== false);
  const [loading, setLoading] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [usernameMessage, setUsernameMessage] = useState({ type: '', text: '' });
  const [preferencesMessage, setPreferencesMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user?.username) {
      setUsernameData({ newUsername: user.username });
    }
    if (user?.show_clock_in_header !== undefined) {
      setShowClockInHeader(user.show_clock_in_header !== false);
    }
  }, [user?.username, user?.show_clock_in_header]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    try {
      await api.put('/users/me/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to change password'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = async (e) => {
    e.preventDefault();
    setUsernameMessage({ type: '', text: '' });

    if (!usernameData.newUsername || usernameData.newUsername.trim().length === 0) {
      setUsernameMessage({ type: 'error', text: 'Username cannot be empty' });
      return;
    }

    if (usernameData.newUsername === user?.username) {
      setUsernameMessage({ type: 'error', text: 'Username is the same as current' });
      return;
    }

    setUsernameLoading(true);
    try {
      const response = await api.put('/users/me/username', {
        newUsername: usernameData.newUsername.trim()
      });
      setUsernameMessage({ type: 'success', text: 'Username changed successfully! Please refresh the page.' });
      // Update local state
      if (response.data.user) {
        setUsernameData({ newUsername: response.data.user.username });
      }
      // Reload page after 2 seconds to update auth context
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setUsernameMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to change username'
      });
    } finally {
      setUsernameLoading(false);
    }
  };

  const handlePreferencesChange = async () => {
    setPreferencesMessage({ type: '', text: '' });
    setPreferencesLoading(true);
    try {
      const response = await api.put('/users/me/preferences', {
        show_clock_in_header: showClockInHeader
      });
      setPreferencesMessage({ type: 'success', text: 'Preferences updated successfully!' });
      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      } else {
        // Fallback: reload page after 1 second
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      setPreferencesMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update preferences'
      });
    } finally {
      setPreferencesLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-neutral-100">My Profile</h1>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-neutral-100">Account Information</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-neutral-200">Full Name</label>
            <p className="text-gray-800 dark:text-neutral-100 mt-1">{user?.full_name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-neutral-200">Email</label>
            <p className="text-gray-800 dark:text-neutral-100 mt-1">{user?.email || 'Not set'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-neutral-200">Role</label>
            <p className="text-gray-800 dark:text-neutral-100 mt-1 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-neutral-100">Preferences</h2>
        
        {preferencesMessage.text && (
          <div className={`mb-4 p-3 rounded ${
            preferencesMessage.type === 'success' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
          }`}>
            {preferencesMessage.text}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-neutral-200">
                Show Clock In/Out in Header
              </label>
              <p className="text-xs text-gray-500 dark:text-neutral-300 mt-1">
                Display clock in/out buttons in the header for quick access
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showClockInHeader}
                  onChange={(e) => setShowClockInHeader(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-neutral-200 after:border-gray-300 dark:after:border-neutral-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
              <button
                onClick={handlePreferencesChange}
                disabled={preferencesLoading || showClockInHeader === (user?.show_clock_in_header !== false)}
                className="px-4 py-2 bg-primary text-white text-sm rounded hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {preferencesLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <PushNotificationSettings />

      {isAdmin && (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-neutral-100">Change Username</h2>
          
          {usernameMessage.text && (
            <div className={`mb-4 p-3 rounded ${
              usernameMessage.type === 'success' 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
            }`}>
              {usernameMessage.text}
            </div>
          )}

          <form onSubmit={handleUsernameChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                Current Username
              </label>
              <p className="text-gray-600 dark:text-neutral-200 mb-3">{user?.username}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                New Username *
              </label>
              <input
                type="text"
                value={usernameData.newUsername}
                onChange={(e) => setUsernameData({ newUsername: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 placeholder-gray-500 dark:placeholder-neutral-400"
                required
                placeholder="Enter new username"
              />
            </div>

            <button
              type="submit"
              disabled={usernameLoading || usernameData.newUsername === user?.username}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {usernameLoading ? 'Changing Username...' : 'Change Username'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-neutral-100">Change Password</h2>
        
        {message.text && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
              Current Password *
            </label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
              New Password *
            </label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 dark:text-neutral-300 mt-1">Must be at least 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;


import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const DEFAULT_NAV_ORDER = ['dashboard', 'mylist', 'tasks', 'time', 'schedule', 'inventory', 'products', 'profile', 'admin'];
const NAV_LABELS = {
  dashboard: 'Dashboard',
  mylist: 'My List',
  tasks: 'Tasks',
  time: 'Time Clock',
  schedule: 'Schedule',
  inventory: 'Inventory',
  products: 'Products',
  profile: 'Profile',
  admin: 'Admin',
};

const Settings = () => {
  const [cleanupEnabled, setCleanupEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [navOrder, setNavOrder] = useState(DEFAULT_NAV_ORDER);
  const [navOrderSaving, setNavOrderSaving] = useState(false);
  const [messagePool, setMessagePool] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [showAddMessage, setShowAddMessage] = useState(false);

  const recommendedText = `Great work today! Before you head out, let's finish strong by ensuring our entire shop is clean and ready for tomorrow. 

A clean shop is a professional shop, and it shows pride in our work. Please take a few minutes to:

• Clean and organize your work area
• Put away all tools and equipment in their proper places
• Wipe down surfaces and dispose of any trash
• Check common areas and help keep the shop looking its best
• Ensure everything is safe and secure

Your attention to detail in keeping our shop clean reflects the quality of work we do. Thank you for being part of a team that takes pride in our workspace!`;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const [cleanupRes, messagesRes, navRes] = await Promise.all([
        api.get('/time/cleanup-reminder'),
        api.get('/time/cleanup-messages').catch(() => ({ data: { messages: [] } })),
        api.get('/settings/nav-order').catch(() => ({ data: { order: DEFAULT_NAV_ORDER } })),
      ]);
      setCleanupEnabled(cleanupRes.data.enabled !== false);
      setMessagePool(messagesRes.data?.messages || []);
      let order = navRes.data?.order;
      if (Array.isArray(order) && order.length > 0) {
        const missing = DEFAULT_NAV_ORDER.filter(k => !order.includes(k));
        if (missing.length > 0) {
          order = [...order];
          for (const key of missing) {
            const defaultIdx = DEFAULT_NAV_ORDER.indexOf(key);
            order.splice(Math.min(defaultIdx, order.length), 0, key);
          }
        }
        setNavOrder(order);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load settings. Please refresh the page.',
      });
    } finally {
      setLoading(false);
    }
  };

  const moveNavItem = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= navOrder.length) return;
    const newOrder = [...navOrder];
    const [removed] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, removed);
    setNavOrder(newOrder);
    setNavOrderSaving(true);
    try {
      await api.put('/settings/nav-order', { order: newOrder });
    } catch (err) {
      setNavOrder(navOrder);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save navigation order.' });
    } finally {
      setNavOrderSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      await api.put('/time/cleanup-reminder', {
        message: '', // Not used anymore, but kept for API compatibility
        enabled: cleanupEnabled
      });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('Error saving cleanup reminder settings:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to save settings' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600 dark:text-neutral-300">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation order */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-neutral-100">Navigation Order</h2>
        <p className="text-gray-600 dark:text-neutral-300 mb-4 text-sm">
          Use the arrows to change the order of links in the sidebar. Changes apply for everyone.
        </p>
        {navOrderSaving && (
          <p className="text-sm text-primary mb-2">Saving order…</p>
        )}
        <div className="space-y-2">
          {navOrder.map((key, index) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-sm"
            >
              <span className="text-gray-800 dark:text-neutral-100 font-medium">{NAV_LABELS[key] || key}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveNavItem(index, -1)}
                  disabled={index === 0 || navOrderSaving}
                  className="p-2 rounded text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-700 dark:hover:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Move up"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveNavItem(index, 1)}
                  disabled={index === navOrder.length - 1 || navOrderSaving}
                  className="p-2 rounded text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-700 dark:hover:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Move down"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-neutral-100">Shop Cleanup Reminder Settings</h2>
        <p className="text-gray-600 dark:text-neutral-300 mb-6">
          Configure the motivational end-of-day reminder message that encourages employees to help keep the entire shop clean and organized.
        </p>

        <div className="space-y-4">
          <div>
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={cleanupEnabled}
                onChange={(e) => setCleanupEnabled(e.target.checked)}
                className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="ml-2 text-gray-700 dark:text-neutral-200 font-medium">
                Enable cleanup reminder popup
              </span>
            </label>
            <p className="text-sm text-gray-500 dark:text-neutral-400 ml-7">
              When enabled, employees will see a reminder popup when they clock out at the end of the day.
            </p>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 text-xl">💡</span>
              <div>
                <h4 className="font-semibold text-yellow-900 mb-1">Rotating Messages</h4>
                <p className="text-sm text-yellow-800">
                  The system automatically rotates through different motivational messages each day to keep things fresh and maintain morale. Employees will see a different message each day, but everyone sees the same message on the same day.
                </p>
              </div>
            </div>
          </div>

          {message.text && (
            <div className={`p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2 rounded-lg font-semibold transition ${
                saving
                  ? 'bg-gray-300 dark:bg-neutral-600 text-gray-500 dark:text-neutral-400 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-dark active:scale-95'
              }`}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={loadSettings}
              disabled={saving}
              className="px-6 py-2 rounded-lg font-semibold bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-300 dark:hover:bg-neutral-600 transition active:scale-95"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Message Pool Management */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Message Pool</h2>
            <p className="text-sm text-gray-600 dark:text-neutral-300 mt-1">
              Manage the rotating messages that employees see. The system automatically selects a different message each day.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddMessage(true);
              setNewMessageText('');
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition active:scale-95 text-sm font-semibold"
          >
            + Add Message
          </button>
        </div>

        {showAddMessage && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-2">
              New Message
            </label>
            <textarea
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary mb-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
              placeholder={recommendedText.substring(0, 100) + '...'}
            />
            <button
              type="button"
              onClick={() => setNewMessageText(recommendedText)}
              className="text-xs px-3 py-1 bg-primary-subtle text-primary rounded hover:bg-primary/20 transition mb-3"
            >
              Use Recommended Template
            </button>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!newMessageText.trim()) {
                    setMessage({ type: 'error', text: 'Message cannot be empty' });
                    return;
                  }
                  try {
                    await api.post('/time/cleanup-messages', { message: newMessageText.trim() });
                    await loadSettings();
                    setShowAddMessage(false);
                    setNewMessageText('');
                    setMessage({ type: 'success', text: 'Message added successfully!' });
                    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
                  } catch (error) {
                    setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to add message' });
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-semibold"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowAddMessage(false);
                  setNewMessageText('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 rounded hover:bg-gray-300 dark:hover:bg-neutral-600 transition text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messagePool.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-neutral-400">
              No messages in pool. Add your first message above!
            </div>
          ) : (
            messagePool.map((msg) => (
              <div key={msg.id} className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
                {editingMessage === msg.id ? (
                  <div>
                    <textarea
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary mb-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          if (!newMessageText.trim()) {
                            setMessage({ type: 'error', text: 'Message cannot be empty' });
                            return;
                          }
                          try {
                            await api.put(`/time/cleanup-messages/${msg.id}`, {
                              message: newMessageText.trim(),
                              enabled: msg.enabled
                            });
                            await loadSettings();
                            setEditingMessage(null);
                            setNewMessageText('');
                            setMessage({ type: 'success', text: 'Message updated successfully!' });
                            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
                          } catch (error) {
                            setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update message' });
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-semibold"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingMessage(null);
                          setNewMessageText('');
                        }}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-neutral-600 text-gray-700 dark:text-neutral-200 rounded hover:bg-gray-300 dark:hover:bg-neutral-500 transition text-sm font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-gray-700 dark:text-neutral-200 whitespace-pre-line text-sm">{msg.message}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={msg.enabled === 1}
                              onChange={async (e) => {
                                try {
                                  await api.put(`/time/cleanup-messages/${msg.id}`, {
                                    message: msg.message,
                                    enabled: e.target.checked
                                  });
                                  await loadSettings();
                                } catch (error) {
                                  setMessage({ type: 'error', text: 'Failed to update message' });
                                }
                              }}
                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <span className="ml-2 text-xs text-gray-600 dark:text-neutral-400">
                              {msg.enabled === 1 ? 'Enabled' : 'Disabled'}
                            </span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            setEditingMessage(msg.id);
                            setNewMessageText(msg.message);
                          }}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 rounded hover:bg-gray-200 dark:hover:bg-neutral-600 transition text-sm"
                          title="Edit message"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this message?')) {
                              try {
                                await api.delete(`/time/cleanup-messages/${msg.id}`);
                                await loadSettings();
                                setMessage({ type: 'success', text: 'Message deleted successfully!' });
                                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
                              } catch (error) {
                                setMessage({ type: 'error', text: 'Failed to delete message' });
                              }
                            }
                          }}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition text-sm"
                          title="Delete message"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-primary-subtle dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-lg p-4">
        <h3 className="font-semibold text-neutral-800 mb-2">💡 How it works:</h3>
        <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
          <li>The reminder popup appears when employees clock out at the end of the day (after 2 PM Central Time)</li>
          <li>Employees must check the acknowledgment box before they can close the popup</li>
          <li>The reminder does not appear for lunch breaks</li>
          <li>Messages rotate daily - everyone sees the same message on the same day, but it changes each day</li>
          <li>Add multiple messages to the pool to keep things fresh and maintain morale</li>
        </ul>
      </div>
    </div>
  );
};

export default Settings;


import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';

const SystemUpdates = () => {
  const [updates, setUpdates] = useState([]);
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedPending, setSelectedPending] = useState(new Set());

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    version: '',
    update_type: 'feature',
    priority: 'medium',
    show_on_login: true,
    is_active: true,
    auto_approve: false
  });

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    setLoading(true);
    try {
      const [allResponse, pendingResponse] = await Promise.all([
        api.get('/updates/admin/all'),
        api.get('/updates/admin/pending')
      ]);
      setUpdates(allResponse.data.updates || []);
      setPendingUpdates(pendingResponse.data.updates || []);
    } catch (error) {
      console.error('Error loading updates:', error);
      setMessage({ type: 'error', text: 'Failed to load updates' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      if (editingUpdate) {
        await api.put(`/updates/admin/${editingUpdate.id}`, formData);
        setMessage({ type: 'success', text: 'Update updated successfully!' });
      } else {
        await api.post('/updates/admin', formData);
        if (formData.auto_approve) {
          setMessage({ type: 'success', text: 'Update created and published immediately!' });
        } else {
          setMessage({ type: 'success', text: 'Update created and pending approval!' });
        }
      }
      
      setShowForm(false);
      setEditingUpdate(null);
      resetForm();
      loadUpdates();
      
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to save update' 
      });
    }
  };

  const handleEdit = (update) => {
    setEditingUpdate(update);
    setFormData({
      title: update.title,
      content: update.content,
      version: update.version || '',
      update_type: update.update_type,
      priority: update.priority,
      show_on_login: update.show_on_login === 1,
      is_active: update.is_active === 1
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this update?')) {
      return;
    }

    try {
      await api.delete(`/updates/admin/${id}`);
      setMessage({ type: 'success', text: 'Update deleted successfully!' });
      loadUpdates();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to delete update' 
      });
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/updates/admin/${id}/approve`);
      setMessage({ type: 'success', text: 'Update approved and published!' });
      loadUpdates();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to approve update' 
      });
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this update? It will be deleted.')) {
      return;
    }

    try {
      await api.post(`/updates/admin/${id}/reject`);
      setMessage({ type: 'success', text: 'Update rejected and deleted' });
      loadUpdates();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to reject update' 
      });
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPending.size === 0) {
      setMessage({ type: 'error', text: 'Please select at least one update to approve' });
      return;
    }

    try {
      await api.post('/updates/admin/bulk-approve', {
        update_ids: Array.from(selectedPending)
      });
      setMessage({ type: 'success', text: `${selectedPending.size} update(s) approved and published!` });
      setSelectedPending(new Set());
      loadUpdates();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to approve updates' 
      });
    }
  };

  const togglePendingSelection = (id) => {
    const newSet = new Set(selectedPending);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPending(newSet);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      version: '',
      update_type: 'feature',
      priority: 'medium',
      show_on_login: true,
      is_active: true,
      auto_approve: false
    });
    setEditingUpdate(null);
  };

  const getUpdateTypeColor = (type) => {
    const colors = {
      feature: 'bg-blue-100 text-blue-800',
      bugfix: 'bg-green-100 text-green-800',
      improvement: 'bg-purple-100 text-purple-800',
      announcement: 'bg-yellow-100 text-yellow-800',
      maintenance: 'bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-neutral-100'
    };
    return colors[type] || colors.feature;
  };

  const getReadPercentage = (readCount, totalUsers) => {
    if (!totalUsers || totalUsers === 0) return 0;
    return Math.round((readCount / totalUsers) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading updates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">System Updates</h2>
          <p className="text-gray-600 mt-1">Manage system update notifications for all users</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Update
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Pending Updates Section */}
      {pendingUpdates.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-yellow-900">
                ⏳ Pending Approval ({pendingUpdates.length})
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Review and approve updates before they go live to all users
              </p>
            </div>
            {selectedPending.size > 0 && (
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Approve Selected ({selectedPending.size})
              </button>
            )}
          </div>

          <div className="space-y-3">
            {pendingUpdates.map((update) => (
              <div
                key={update.id}
                className="bg-white dark:bg-neutral-950 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPending.has(update.id)}
                    onChange={() => togglePendingSelection(update.id)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{update.title}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {update.content}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>Created: {formatDateTime(update.created_at)}</span>
                          {update.created_by_name && (
                            <span>by {update.created_by_name}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded ${getUpdateTypeColor(update.update_type)}`}>
                            {update.update_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleApprove(update.id)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleReject(update.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-xl dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  {editingUpdate ? 'Edit Update' : 'Create New Update'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={8}
                    required
                    placeholder="Describe the update in detail. This will be shown to all users."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 1.2.3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.update_type}
                      onChange={(e) => setFormData({ ...formData, update_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="feature">Feature</option>
                      <option value="bugfix">Bug Fix</option>
                      <option value="improvement">Improvement</option>
                      <option value="announcement">Announcement</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.show_on_login}
                      onChange={(e) => setFormData({ ...formData, show_on_login: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Show on login (users will see this when they log in)
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Active (update is visible to users)
                    </span>
                  </label>

                  {!editingUpdate && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.auto_approve || false}
                        onChange={(e) => setFormData({ ...formData, auto_approve: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Auto-approve (skip pending status and publish immediately)
                      </span>
                    </label>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingUpdate ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Updates List */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-neutral-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Read
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-950 divide-y divide-gray-200 dark:divide-neutral-700">
              {updates.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No updates yet. Create your first update!
                  </td>
                </tr>
              ) : (
                updates.map((update) => (
                  <tr key={update.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{update.title}</div>
                      {update.version && (
                        <div className="text-sm text-gray-500">v{update.version}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded ${getUpdateTypeColor(update.update_type)}`}>
                        {update.update_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {update.is_pending === 1 ? (
                          <span className="text-xs text-yellow-600 font-semibold">⏳ Pending Approval</span>
                        ) : (
                          <span className={`text-xs ${update.is_active === 1 ? 'text-green-600' : 'text-gray-400'}`}>
                            {update.is_active === 1 ? '✓ Active' : 'Inactive'}
                          </span>
                        )}
                        {update.show_on_login === 1 && update.is_pending !== 1 && (
                          <span className="text-xs text-blue-600">Shows on login</span>
                        )}
                        {update.approved_by_name && (
                          <span className="text-xs text-gray-500">Approved by {update.approved_by_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {update.read_count || 0} / {update.total_users || 0} users
                      <div className="text-xs text-gray-400">
                        ({getReadPercentage(update.read_count, update.total_users)}%)
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDateTime(update.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(update)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(update.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemUpdates;

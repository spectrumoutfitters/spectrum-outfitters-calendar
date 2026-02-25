import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const WorkListItemDetail = ({ item, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [notes, setNotes] = useState(item?.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actualMinutes, setActualMinutes] = useState('');

  useEffect(() => {
    if (item) {
      loadDetails();
      setNotes(item.notes || '');
    }
  }, [item]);

  const loadDetails = async () => {
    if (!item) return;
    setLoading(true);
    try {
      const response = await api.get(`/admin/worklist/items/${item.id}/details`);
      setDetails(response.data);
    } catch (error) {
      console.error('Error loading item details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.post(`/admin/worklist/items/${item.id}/notes`, { notes });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Mark this item as completed?')) return;
    setCompleting(true);
    try {
      await api.post(`/admin/worklist/items/${item.id}/complete`, {
        actual_minutes: actualMinutes ? parseInt(actualMinutes) : null
      });
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error completing item:', error);
      alert('Failed to complete item');
    } finally {
      setCompleting(false);
    }
  };

  const handleQuickAction = async (action) => {
    if (!confirm(`Are you sure you want to ${action}?`)) return;
    try {
      let endpoint = '';
      if (action === 'approve-time') {
        endpoint = `/admin/worklist/items/${item.id}/quick-approve-time`;
      } else if (action === 'approve-task') {
        endpoint = `/admin/worklist/items/${item.id}/quick-approve-task`;
      } else if (action === 'approve-timeoff') {
        endpoint = `/admin/worklist/items/${item.id}/quick-approve-timeoff`;
      }

      if (endpoint) {
        await api.post(endpoint);
        if (onUpdate) onUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Error performing quick action:', error);
      alert(`Failed to ${action}`);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-neutral-200 border-gray-300 dark:border-neutral-600';
      default: return 'bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-neutral-200 border-gray-300 dark:border-neutral-600';
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'time_approval': 'Time Approval',
      'task_review': 'Task Review',
      'compliance': 'Compliance',
      'inventory': 'Inventory',
      'general': 'General'
    };
    return labels[category] || category;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-900 rounded-lg dark:border dark:border-neutral-700 p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading details...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700 px-6 py-4 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-800">{item?.title}</h2>
              {item?.priority && (
                <span className={`px-2 py-1 rounded text-xs font-semibold border ${getPriorityColor(item.priority)}`}>
                  {item.priority.toUpperCase()}
                </span>
              )}
              {item?.category && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {getCategoryLabel(item.category)}
                </span>
              )}
            </div>
            {item?.description && (
              <p className="text-gray-600">{item.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold ml-4"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Actions */}
          {!item?.is_completed && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                {item?.smart_key === 'unapproved_time_entries' && (
                  <button
                    onClick={() => handleQuickAction('approve-time')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    ✓ Approve All Time Entries
                  </button>
                )}
                {item?.smart_key === 'tasks_in_review' && (
                  <button
                    onClick={() => handleQuickAction('approve-task')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    ✓ Approve All Tasks
                  </button>
                )}
                {item?.smart_key === 'pending_time_off' && (
                  <button
                    onClick={() => handleQuickAction('approve-timeoff')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    ✓ Approve All Time Off Requests
                  </button>
                )}
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
                >
                  {completing ? 'Completing...' : '✓ Mark Complete'}
                </button>
              </div>
              {item?.smart_key && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time taken (minutes):
                  </label>
                  <input
                    type="number"
                    value={actualMinutes}
                    onChange={(e) => setActualMinutes(e.target.value)}
                    placeholder="Optional"
                    className="w-32 px-3 py-1 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
            </div>
          )}

          {/* Item Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Type</label>
              <p className="text-gray-900 capitalize">{item?.item_type}</p>
            </div>
            {item?.due_time && (
              <div>
                <label className="text-sm font-medium text-gray-500">Due Time</label>
                <p className="text-gray-900">{item.due_time}</p>
              </div>
            )}
            {item?.estimated_minutes && (
              <div>
                <label className="text-sm font-medium text-gray-500">Estimated Time</label>
                <p className="text-gray-900">{item.estimated_minutes} minutes</p>
              </div>
            )}
            {item?.actual_minutes && (
              <div>
                <label className="text-sm font-medium text-gray-500">Actual Time</label>
                <p className="text-gray-900">{item.actual_minutes} minutes</p>
              </div>
            )}
            {item?.assigned_to_name && (
              <div>
                <label className="text-sm font-medium text-gray-500">Assigned To</label>
                <p className="text-gray-900">{item.assigned_to_name}</p>
              </div>
            )}
            {item?.is_completed && item?.completed_by_name && (
              <div>
                <label className="text-sm font-medium text-gray-500">Completed By</label>
                <p className="text-gray-900">{item.completed_by_name}</p>
              </div>
            )}
            {item?.is_completed && item?.completed_at && (
              <div>
                <label className="text-sm font-medium text-gray-500">Completed At</label>
                <p className="text-gray-900">{formatTime(item.completed_at)}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Add notes about this item..."
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="mt-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          {/* Related Items */}
          {details?.relatedItems && details.relatedItems.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Related Items</h3>
              <div className="space-y-2">
                {details.relatedItems.map((related, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
                    {related.full_name && (
                      <p className="font-medium text-gray-800">{related.full_name}</p>
                    )}
                    {related.title && (
                      <p className="text-gray-700">{related.title}</p>
                    )}
                    {related.start_date && related.end_date && (
                      <p className="text-sm text-gray-600">
                        {new Date(related.start_date).toLocaleDateString()} - {new Date(related.end_date).toLocaleDateString()}
                      </p>
                    )}
                    {related.work_date && (
                      <p className="text-sm text-gray-600">Date: {related.work_date}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion History */}
          {details?.history && details.history.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Completion History</h3>
              <div className="space-y-2">
                {details.history.map((entry) => (
                  <div key={entry.id} className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{entry.completed_by_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-600">{formatTime(entry.completed_at)}</p>
                        {entry.time_taken_minutes && (
                          <p className="text-sm text-gray-600">Time: {entry.time_taken_minutes} minutes</p>
                        )}
                      </div>
                    </div>
                    {entry.notes && (
                      <p className="text-sm text-gray-700 mt-2">{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {item?.metadata && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Additional Information</h3>
              <pre className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-3 text-xs overflow-auto text-gray-900 dark:text-neutral-100">
                {JSON.stringify(JSON.parse(item.metadata), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkListItemDetail;

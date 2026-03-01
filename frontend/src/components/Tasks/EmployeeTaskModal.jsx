import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import { formatDateTime, formatDate, getDueDateColor } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import TaskTimer from './TaskTimer';

const EmployeeTaskModal = ({ task, onClose }) => {
  const { user } = useAuth();
  const [taskData, setTaskData] = useState(task);
  const [loading, setLoading] = useState(false);
  const [togglingSubtask, setTogglingSubtask] = useState(null); // Track which subtask is being toggled
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [torquedToSpec, setTorquedToSpec] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakReason, setBreakReason] = useState('');
  const [breakNotes, setBreakNotes] = useState('');
  const [breakType, setBreakType] = useState('lunch'); // 'lunch' or 'other'
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventorySearchLoading, setInventorySearchLoading] = useState(false);
  const [addInventoryQty, setAddInventoryQty] = useState('');
  const [addingInventoryItemId, setAddingInventoryItemId] = useState(null);
  const [editQtyValue, setEditQtyValue] = useState({});
  const [updatingUsageId, setUpdatingUsageId] = useState(null);

  useEffect(() => {
    loadFullTaskData();
  }, [task.id]);

  useEffect(() => {
    if (!showAddInventory) return;
    const t = window.setTimeout(() => {
      setInventorySearchLoading(true);
      api.get('/inventory/items', { params: inventorySearch.trim() ? { q: inventorySearch.trim() } : {} })
        .then((res) => setInventoryItems(res.data?.items || []))
        .catch(() => setInventoryItems([]))
        .finally(() => setInventorySearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [showAddInventory, inventorySearch]);

  const isFluidOrConsumable = (item) => {
    const cat = (item?.category_name || '').toLowerCase();
    const unit = (item?.unit || item?.item_unit || '').toLowerCase();
    return cat.includes('oil') || cat.includes('fluid') || cat.includes('cleaning') ||
      unit.includes('oz') || unit.includes('qt') || unit.includes('gal') || unit.includes('bottle') || unit.includes('can');
  };

  const handleLinkInventoryItem = async (item, qtyInput) => {
    const isFluid = isFluidOrConsumable(item);
    const quantityUsed = isFluid && qtyInput !== undefined && qtyInput !== '' && qtyInput !== null
      ? (parseFloat(qtyInput) || null)
      : (isFluid ? null : 1);
    setAddingInventoryItemId(item.id);
    try {
      const res = await api.post(`/tasks/${task.id}/inventory`, {
        item_id: item.id,
        quantity_used: quantityUsed
      });
      setTaskData((prev) => ({
        ...prev,
        inventory_usage: [...(prev.inventory_usage || []), res.data.usage]
      }));
      setAddInventoryQty('');
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to link item');
    } finally {
      setAddingInventoryItemId(null);
    }
  };

  const handleUpdateQuantityUsed = async (usageId, newQty) => {
    setUpdatingUsageId(usageId);
    try {
      const res = await api.patch(`/tasks/${task.id}/inventory/${usageId}`, {
        quantity_used: newQty === '' || newQty === null ? null : parseFloat(newQty)
      });
      setTaskData((prev) => ({
        ...prev,
        inventory_usage: (prev.inventory_usage || []).map((u) =>
          u.id === usageId ? res.data.usage : u
        )
      }));
      setEditQtyValue((prev) => ({ ...prev, [usageId]: undefined }));
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update');
    } finally {
      setUpdatingUsageId(null);
    }
  };

  const handleRemoveInventoryUsage = async (usageId) => {
    if (!confirm('Remove this item from the task?')) return;
    try {
      await api.delete(`/tasks/${task.id}/inventory/${usageId}`);
      setTaskData((prev) => ({
        ...prev,
        inventory_usage: (prev.inventory_usage || []).filter((u) => u.id !== usageId)
      }));
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to remove');
    }
  };

  const loadFullTaskData = async () => {
    setInitialLoading(true);
    try {
      // Fetch full task data to ensure subtasks are loaded
      const response = await api.get('/tasks');
      const fullTask = response.data.tasks.find(t => t.id === task.id);
      if (fullTask) {
        setTaskData(fullTask);
      } else {
        setTaskData(task);
      }
    } catch (error) {
      console.error('Error loading task data:', error);
      setTaskData(task);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubtaskToggle = async (subtaskId, currentStatus) => {
    console.log('handleSubtaskToggle called', { subtaskId, currentStatus, loading });
    setTogglingSubtask(subtaskId);
    try {
      const response = await api.put(`/tasks/${task.id}/subtasks/${subtaskId}`, {
        is_completed: !currentStatus
      });
      
      setTaskData(prev => ({
        ...prev,
        subtasks: prev.subtasks.map(st => 
          st.id === subtaskId ? response.data.subtask : st
        )
      }));
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      alert(error.response?.data?.error || 'Failed to update checklist item');
    } finally {
      setTogglingSubtask(null);
    }
  };

  const handleStartTask = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/tasks/${task.id}/start`);
      setTaskData(response.data.task);
      alert('Task started! Time tracking has begun.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to start task');
    } finally {
      setLoading(false);
    }
  };

  const allSubtasksCompleted = taskData.subtasks && taskData.subtasks.length > 0 && 
    taskData.subtasks.every(st => st.is_completed === 1);

  const handleSubmitForReview = async () => {
    if (!torquedToSpec) {
      alert('Please confirm that everything is torqued to spec');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/tasks/${task.id}/submit-for-review`, {
        torqued_to_spec: torquedToSpec
      });
      setTaskData(response.data.task);
      setShowSubmitConfirm(false);
      alert('Task submitted for admin review!');
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit task for review');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.post(`/tasks/${task.id}/comments`, { comment });
      setTaskData({
        ...taskData,
        comments: [...(taskData.comments || []), response.data.comment]
      });
      setComment('');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!breakReason.trim()) {
      alert('Please enter a reason for the pause');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/tasks/${task.id}/break/start`, {
        reason: breakReason.trim(),
        notes: breakNotes.trim() || null
      });
      await loadFullTaskData(); // Reload task data to get updated break info
      setShowBreakModal(false);
      setBreakReason('');
      setBreakNotes('');
      setBreakType('lunch');
      alert('Pause started! Time tracking is paused.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to start pause');
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setLoading(true);
    try {
      await api.post(`/tasks/${task.id}/break/end`);
      await loadFullTaskData(); // Reload task data to get updated break info
      alert('Pause ended! Time tracking has resumed.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to end pause');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
        <div className="bg-white dark:bg-neutral-950 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-2xl w-full p-6">
          <div className="text-center">Loading task details...</div>
        </div>
      </div>
    );
  }

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-neutral-950 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-neutral-100 break-words pr-2">{taskData.title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            {/* Start Task Button */}
            {!taskData.started_at && taskData.status !== 'completed' && taskData.status !== 'review' && (
              <div className="bg-primary-subtle border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-medium text-neutral-800 mb-3">
                  Ready to begin? Start the timer to track your work time.
                </p>
                <button
                  onClick={handleStartTask}
                  disabled={loading}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Task
                </button>
              </div>
            )}

            {/* Task Started Info */}
            {taskData.started_at && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-green-800">
                      <span className="font-semibold">⏱️ Started:</span> {formatDateTime(taskData.started_at)}
                      {taskData.started_by_name && ` by ${taskData.started_by_name}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <TaskTimer task={taskData} />
                    {taskData.timeTracking && (
                      <p className="text-xs text-green-600 mt-1">
                        Working time
                      </p>
                    )}
                  </div>
                </div>
                {taskData.active_break && (
                  <div className="bg-orange-100 border border-orange-300 rounded p-2 mt-2">
                    <p className="text-sm text-orange-800 font-semibold">
                      ⏸️ On Pause: {taskData.active_break.reason}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      Started: {formatDateTime(taskData.active_break.break_start)}
                    </p>
                    {taskData.active_break.notes && (
                      <p className="text-xs text-orange-600 mt-1 italic">{taskData.active_break.notes}</p>
                    )}
                  </div>
                )}
                {taskData.breaks && taskData.breaks.filter(b => b.break_end).length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-green-700 font-medium mb-1">Pause History:</p>
                    <div className="space-y-1">
                      {taskData.breaks.filter(b => b.break_end).slice(0, 3).map((breakItem) => {
                        const startTime = new Date(breakItem.break_start);
                        const endTime = new Date(breakItem.break_end);
                        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                        return (
                          <p key={breakItem.id} className="text-xs text-green-700">
                            • {breakItem.reason} ({durationMinutes} min)
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!taskData.active_break && taskData.status !== 'completed' && taskData.status !== 'review' && (
                  <button
                    onClick={() => setShowBreakModal(true)}
                    disabled={loading}
                    className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2 text-sm w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pause Task
                  </button>
                )}
                {taskData.active_break && (
                  <button
                    onClick={handleEndBreak}
                    disabled={loading}
                    className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2 text-sm w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Resume Task
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <p className="mt-1 text-gray-800">{taskData.description || 'No description'}</p>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Task Checklist</div>
              {taskData.subtasks && taskData.subtasks.length > 0 ? (
                <div className="space-y-2">
                  {taskData.subtasks.map((subtask) => {
                    const checkboxId = `subtask-${subtask.id}`;
                    return (
                      <label
                        key={subtask.id}
                        htmlFor={checkboxId}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={(e) => {
                          // Prevent label from triggering if clicking directly on checkbox
                          if (e.target.tagName !== 'INPUT') {
                            e.preventDefault();
                            const checkbox = document.getElementById(checkboxId);
                            if (checkbox && !checkbox.disabled) {
                              checkbox.click();
                            }
                          }
                        }}
                      >
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={subtask.is_completed === 1}
                          onChange={(e) => {
                            e.stopPropagation();
                            console.log('CHECKBOX CHANGED!', subtask.id);
                            handleSubtaskToggle(subtask.id, subtask.is_completed === 1);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('CHECKBOX CLICKED!', subtask.id);
                          }}
                          className="w-5 h-5 accent-primary"
                          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                          disabled={false}
                        />
                        <span className={`flex-1 select-none ${subtask.is_completed === 1 ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                          {subtask.title}
                        </span>
                        {subtask.is_completed === 1 && (
                          <div className="text-xs text-gray-500 flex-shrink-0 text-right">
                            {subtask.completed_by_name && (
                              <div>✓ {subtask.completed_by_name}</div>
                            )}
                            {subtask.completed_at && (
                              <div className="text-gray-400">{formatDateTime(subtask.completed_at)}</div>
                            )}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-primary-subtle border border-primary/20 rounded-lg p-4">
                  <p className="text-neutral-800 text-sm">
                    📋 No checklist items yet. Contact your admin to add items to this task.
                  </p>
                </div>
              )}
            </div>

            {allSubtasksCompleted && taskData.status !== 'review' && taskData.status !== 'completed' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-800 mb-3">
                  ✓ All tasks completed! Ready to submit for review?
                </p>
                {!showSubmitConfirm ? (
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    className="px-4 py-2 bg-warning text-white rounded-lg hover:bg-yellow-600 transition"
                  >
                    Submit for Review
                  </button>
                ) : (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={torquedToSpec}
                        onChange={(e) => setTorquedToSpec(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-primary"
                      />
                      <span className="text-sm font-medium">
                        I confirm all tasks are completed and everything is torqued to spec
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSubmitForReview}
                        disabled={loading || !torquedToSpec}
                        className="px-4 py-2 bg-success text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {loading ? 'Submitting...' : 'Confirm & Submit'}
                      </button>
                      <button
                        onClick={() => {
                          setShowSubmitConfirm(false);
                          setTorquedToSpec(false);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {taskData.status === 'review' && (
              <div className="bg-primary-subtle border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-medium text-neutral-800">
                  ⏳ This task is pending admin approval
                </p>
                {taskData.torqued_to_spec === 1 && (
                  <p className="text-xs text-primary mt-1">✓ Torqued to spec confirmed</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1 text-gray-800 capitalize">{taskData.status.replace('_', ' ')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <p className="mt-1 text-gray-800">{taskData.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Due Date</label>
                <p className={`mt-1 ${taskData.due_date ? getDueDateColor(taskData.due_date) : 'text-gray-800'}`}>
                  {formatDate(taskData.due_date) || 'No due date'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Created</label>
                <p className="mt-1 text-gray-800">{formatDateTime(taskData.created_at)}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Notes & Comments</label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {taskData.comments && taskData.comments.length > 0 ? (
                  taskData.comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium text-sm">{comment.user_name}</span>
                        <span className="text-xs text-gray-500">{formatDateTime(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{comment.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No comments yet</p>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a note or comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={handleAddComment}
                  disabled={loading || !comment.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Parts & materials linked to this task */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="text-sm font-medium text-gray-700">Parts & materials</label>
                <button
                  type="button"
                  onClick={() => { setShowAddInventory(!showAddInventory); setInventorySearch(''); setAddInventoryQty(''); setAddingInventoryItemId(null); }}
                  className="text-sm px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
                >
                  + Add part or material
                </button>
              </div>
              {showAddInventory && (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700">Add from inventory</span>
                    <button
                      type="button"
                      onClick={() => { setShowAddInventory(false); setInventorySearch(''); setAddInventoryQty(''); setAddingInventoryItemId(null); }}
                      className="p-1 rounded hover:bg-gray-200 text-gray-600"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search inventory..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                  />
                  {inventorySearchLoading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                  ) : (
                    <ul className="max-h-48 overflow-y-auto space-y-1">
                      {(inventoryItems || [])
                        .filter((it) => !(taskData.inventory_usage || []).some((u) => u.item_id === it.id))
                        .slice(0, 30)
                        .map((it) => (
                          <li key={it.id} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                            <span className="text-sm font-medium flex-1 min-w-0 truncate">{it.name}</span>
                            <span className="text-xs text-gray-500">{it.category_name || '—'}</span>
                            {addingInventoryItemId === it.id ? (
                              isFluidOrConsumable(it) ? (
                                <span className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="Qty used"
                                    value={addInventoryQty}
                                    onChange={(e) => setAddInventoryQty(e.target.value)}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <button type="button" onClick={() => handleLinkInventoryItem(it, addInventoryQty)} className="text-xs px-2 py-1 bg-primary text-white rounded">Add</button>
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500">Adding…</span>
                              )
                            ) : isFluidOrConsumable(it) ? (
                              <button type="button" onClick={() => { setAddingInventoryItemId(it.id); setAddInventoryQty(''); }} className="text-xs px-2 py-1 bg-primary text-white rounded">Add + qty</button>
                            ) : (
                              <button type="button" onClick={() => handleLinkInventoryItem(it)} disabled={addingInventoryItemId != null} className="text-xs px-2 py-1 bg-primary text-white rounded disabled:opacity-50">Add</button>
                            )}
                          </li>
                        ))}
                      {inventoryItems.length === 0 && !inventorySearchLoading && (
                        <li className="text-sm text-gray-500 py-2">No items found. Try a different search.</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              {(taskData.inventory_usage || []).length === 0 && !showAddInventory && (
                <p className="text-gray-500 text-sm">No parts or materials linked yet.</p>
              )}
              {(taskData.inventory_usage || []).length > 0 && (
                <ul className="space-y-2">
                  {(taskData.inventory_usage || []).map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="font-medium text-sm flex-1 min-w-0">{u.item_name}</span>
                      <span className="text-xs text-gray-500">{u.category_name || ''} · {u.item_unit || 'each'}</span>
                      {isFluidOrConsumable(u) ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Qty used"
                            value={editQtyValue[u.id] !== undefined ? editQtyValue[u.id] : (u.quantity_used ?? '')}
                            onChange={(e) => setEditQtyValue((prev) => ({ ...prev, [u.id]: e.target.value }))}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (String(v).trim() !== '' && parseFloat(v) !== parseFloat(u.quantity_used)) {
                                handleUpdateQuantityUsed(u.id, v);
                              }
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target.blur(), handleUpdateQuantityUsed(u.id, editQtyValue[u.id] ?? u.quantity_used ?? ''))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          {u.item_unit && <span className="text-xs text-gray-500">{u.item_unit}</span>}
                          {updatingUsageId === u.id && <span className="text-xs text-gray-400">Saving…</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">{u.quantity_used != null ? u.quantity_used : '1'} used</span>
                      )}
                      <button type="button" onClick={() => handleRemoveInventoryUsage(u.id)} className="text-red-600 hover:text-red-800 text-sm" title="Remove from task">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pause Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[10000] p-0 sm:p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-neutral-100">Pause Task</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Pause <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="breakType"
                      value="lunch"
                      checked={breakType === 'lunch'}
                      onChange={(e) => {
                        setBreakType(e.target.value);
                        setBreakReason('Lunch');
                      }}
                      className="w-4 h-4"
                    />
                    <span>Lunch</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="breakType"
                      value="other"
                      checked={breakType === 'other'}
                      onChange={(e) => {
                        setBreakType(e.target.value);
                        setBreakReason('');
                      }}
                      className="w-4 h-4"
                    />
                    <span>Other (specify below)</span>
                  </label>
                </div>
                {breakType === 'other' && (
                  <input
                    type="text"
                    value={breakReason}
                    onChange={(e) => setBreakReason(e.target.value)}
                    placeholder="e.g., Pulled to work on another car"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={breakNotes}
                  onChange={(e) => setBreakNotes(e.target.value)}
                  placeholder="Any additional details..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleStartBreak}
                  disabled={loading || !breakReason.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 text-sm md:text-base min-h-[44px]"
                >
                  {loading ? 'Pausing...' : 'Start Pause'}
                </button>
                <button
                  onClick={() => {
                    setShowBreakModal(false);
                    setBreakReason('');
                    setBreakNotes('');
                    setBreakType('lunch');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm md:text-base min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render modal outside DndContext using portal to avoid interference
  return createPortal(modalContent, document.body);
};

export default EmployeeTaskModal;


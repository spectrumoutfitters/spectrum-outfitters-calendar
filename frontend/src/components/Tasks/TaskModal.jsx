import React, { useState, useEffect } from 'react';
import TaskTimer from './TaskTimer';
import TaskPhotos from './TaskPhotos';
import api from '../../utils/api';
import { formatDateTime, getPriorityColor, getCategoryColor, formatDate, toTitleCase, calculateDuration, calculateTotalDuration, calculateDurationMinutes, getDueDateColor, formatDuration } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import { parseISO } from 'date-fns';
import BarcodeScannerModal from '../Inventory/BarcodeScannerModal';


const TaskModal = ({ task, onClose }) => {
  const { user, isAdmin } = useAuth();
  const [taskData, setTaskData] = useState(task);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [comment, setComment] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [users, setUsers] = useState([]);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [qualityChecks, setQualityChecks] = useState([]);
  const [loadingQualityChecks, setLoadingQualityChecks] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySearchLoading, setInventorySearchLoading] = useState(false);
  const [addInventoryQty, setAddInventoryQty] = useState('');
  const [addingInventoryItemId, setAddingInventoryItemId] = useState(null);
  const [updatingUsageId, setUpdatingUsageId] = useState(null);
  const [editQtyValue, setEditQtyValue] = useState({});
  const [returnModal, setReturnModal] = useState(null);
  const [returnSupplier, setReturnSupplier] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);

  // Parts Used (scan-to-use)
  const [partsUsed, setPartsUsed] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [showPartScanner, setShowPartScanner] = useState(false);

  // Share Status (admin only)
  const [shareCustomerName, setShareCustomerName] = useState('');
  const [shareCustomerPhone, setShareCustomerPhone] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    loadFullTaskData();
    loadUsers();
    loadPartsUsed();
  }, [task.id]);

  const loadPartsUsed = async () => {
    setPartsLoading(true);
    try {
      const res = await api.get(`/inventory/task-usage/${task.id}`);
      setPartsUsed(res.data?.usage || []);
    } catch (e) {
      setPartsUsed([]);
    } finally {
      setPartsLoading(false);
    }
  };

  useEffect(() => {
    if (taskData.id && taskData.status !== 'completed') {
      loadQualityChecks();
      loadRecommendations();
    }
  }, [taskData.id, taskData.status]);

  const loadQualityChecks = async () => {
    // Disabled by default - don't auto-load to prevent CPU usage
    // Quality checks can be manually enabled if needed
    return;
    
    // Original code (disabled):
    // if (!taskData.id || taskData.status === 'completed') return;
    // setLoadingQualityChecks(true);
    // try {
    //   const response = await api.get(`/tasks/${taskData.id}/quality-checks`);
    //   setQualityChecks(response.data.checks || []);
    // } catch (error) {
    //   console.warn('Could not load quality checks:', error);
    // } finally {
    //   setLoadingQualityChecks(false);
    // }
  };

  const loadRecommendations = async () => {
    // Disabled by default - don't auto-load to prevent CPU usage
    // Recommendations can be manually enabled if needed
    return;
    
    // Original code (disabled):
    // if (!taskData.id) return;
    // setLoadingRecommendations(true);
    // try {
    //   const response = await api.get(`/tasks/${taskData.id}/recommendations`);
    //   setRecommendations(response.data);
    // } catch (error) {
    //   console.warn('Could not load recommendations:', error);
    // } finally {
    //   setLoadingRecommendations(false);
    // }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers((Array.isArray(response.data.users) ? response.data.users : []).filter(u => u.is_active));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadFullTaskData = async () => {
    try {
      // Fetch full task data to ensure subtasks are loaded
      const response = await api.get('/tasks');
      const fullTask = response.data.tasks.find(t => t.id === task.id);
      if (fullTask) {
        setTaskData(fullTask);
        setEditData({
          title: fullTask.title,
          description: fullTask.description,
          assigned_to: fullTask.assigned_to,
          assigned_users: fullTask.assigned_users ? fullTask.assigned_users.map(u => u.user_id) : (fullTask.assigned_to ? [fullTask.assigned_to] : []),
          status: fullTask.status,
          priority: fullTask.priority,
          category: fullTask.category,
          due_date: fullTask.due_date,
          subtasks: fullTask.subtasks || [],
          started_at: fullTask.started_at ? new Date(fullTask.started_at).toISOString().slice(0, 16) : '',
          started_by: fullTask.started_by || '',
          completed_at: fullTask.completed_at ? new Date(fullTask.completed_at).toISOString().slice(0, 16) : '',
          completed_by: fullTask.completed_by || '',
          estimated_time_minutes: fullTask.estimated_time_minutes || ''
        });
      } else {
        setTaskData(task);
        setEditData({
          title: task.title,
          description: task.description,
          assigned_to: task.assigned_to,
          assigned_users: task.assigned_users ? task.assigned_users.map(u => u.user_id) : (task.assigned_to ? [task.assigned_to] : []),
          status: task.status,
          priority: task.priority,
          category: task.category,
          due_date: task.due_date,
          subtasks: task.subtasks || [],
          started_at: task.started_at ? new Date(task.started_at).toISOString().slice(0, 16) : '',
          started_by: task.started_by || '',
          completed_at: task.completed_at ? new Date(task.completed_at).toISOString().slice(0, 16) : '',
          completed_by: task.completed_by || '',
          estimated_time_minutes: task.estimated_time_minutes || ''
        });
      }
      loadTaskHistory();
    } catch (error) {
      console.error('Error loading task data:', error);
      setTaskData(task);
    }
  };

  const loadTaskHistory = async () => {
    try {
      const response = await api.get(`/tasks/${task.id}/history`);
      setHistory(response.data.history);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleGenerateShareLink = async () => {
    setShareLoading(true);
    try {
      const res = await api.post('/customer-status/generate', {
        task_id: task.id,
        customer_name: shareCustomerName || null,
        customer_phone: shareCustomerPhone || null,
      });
      const fullUrl = `${window.location.origin}${res.data.url}`;
      setShareUrl(fullUrl);
    } catch (err) {
      console.error('Failed to generate share link:', err);
    } finally {
      setShareLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Convert assigned_users array to the format expected by backend
      const saveData = {
        ...editData,
        assigned_users: editData.assigned_users || []
      };
      
      // Convert time tracking datetime-local strings to ISO format for backend
      if (isAdmin) {
        if (saveData.started_at) {
          // Convert datetime-local to ISO string
          const startedDate = new Date(saveData.started_at);
          saveData.started_at = startedDate.toISOString();
        } else {
          saveData.started_at = null;
        }
        
        if (saveData.completed_at) {
          const completedDate = new Date(saveData.completed_at);
          saveData.completed_at = completedDate.toISOString();
        } else {
          saveData.completed_at = null;
        }
        
        // Convert user IDs to integers or null
        saveData.started_by = saveData.started_by ? parseInt(saveData.started_by) : null;
        saveData.completed_by = saveData.completed_by ? parseInt(saveData.completed_by) : null;
      }
      
      const response = await api.put(`/tasks/${task.id}`, saveData);
      setTaskData(response.data.task);
      setIsEditing(false);
      await loadTaskHistory();
      await loadFullTaskData(); // Reload to get updated time tracking
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
    
    setLoading(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      alert('Task deleted successfully');
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/tasks/${task.id}/start`);
      await loadFullTaskData();
      alert('Task started! Time tracking has begun.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to start task');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPause = async () => {
    if (!pauseReason.trim()) {
      alert('Please enter a reason for the pause');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/tasks/${task.id}/break/start`, {
        reason: pauseReason.trim(),
        notes: null
      });
      await loadFullTaskData();
      setShowPauseModal(false);
      setPauseReason('');
      alert('Pause started! Time tracking is paused.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to start pause');
    } finally {
      setLoading(false);
    }
  };

  const handleEndPause = async () => {
    setLoading(true);
    try {
      await api.post(`/tasks/${task.id}/break/end`);
      await loadFullTaskData();
      alert('Pause ended! Time tracking has resumed.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to end pause');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!confirm('Mark this task as completed?')) return;
    
    setLoading(true);
    try {
      const response = await api.put(`/tasks/${task.id}`, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id
      });
      await loadFullTaskData();
      alert('Task completed!');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (archive = false) => {
    setLoading(true);
    try {
      const response = await api.post(`/tasks/${task.id}/approve`, { archive });
      setTaskData(response.data.task);
      alert(response.data.message);
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to approve task');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/tasks/${task.id}/archive`);
      setTaskData(response.data.task);
      alert('Task archived');
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to archive task');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setEditData({
      ...editData,
      subtasks: [...(editData.subtasks || []), { title: newSubtask, is_completed: false }]
    });
    setNewSubtask('');
  };

  const handleRemoveSubtask = (index) => {
    const newSubtasks = [...(editData.subtasks || [])];
    newSubtasks.splice(index, 1);
    setEditData({ ...editData, subtasks: newSubtasks });
  };

  const handleSubtaskToggle = async (subtaskId, currentStatus) => {
    setLoading(true);
    try {
      const response = await api.put(`/tasks/${task.id}/subtasks/${subtaskId}`, {
        is_completed: !currentStatus
      });
      
      // Reload full task data to ensure we have the latest state
      await loadFullTaskData();
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      alert(error.response?.data?.error || 'Failed to update checklist item');
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

  const loadInventoryItems = async () => {
    setInventorySearchLoading(true);
    try {
      const params = inventorySearch.trim() ? { q: inventorySearch.trim() } : {};
      const res = await api.get('/inventory/items', { params });
      setInventoryItems(res.data?.items || []);
    } catch (e) {
      setInventoryItems([]);
    } finally {
      setInventorySearchLoading(false);
    }
  };

  useEffect(() => {
    if (!showAddInventory) return;
    const t = window.setTimeout(() => loadInventoryItems(), 300);
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
      setTaskData({
        ...taskData,
        inventory_usage: [...(taskData.inventory_usage || []), res.data.usage]
      });
      setAddInventoryQty('');
      setAddingInventoryItemId(null);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to link item');
      setAddingInventoryItemId(null);
    }
  };

  const handleUpdateQuantityUsed = async (usageId, newQty) => {
    setUpdatingUsageId(usageId);
    try {
      const res = await api.patch(`/tasks/${task.id}/inventory/${usageId}`, {
        quantity_used: newQty === '' || newQty === null ? null : parseFloat(newQty)
      });
      setTaskData({
        ...taskData,
        inventory_usage: (taskData.inventory_usage || []).map((u) =>
          u.id === usageId ? res.data.usage : u
        )
      });
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
      setTaskData({
        ...taskData,
        inventory_usage: (taskData.inventory_usage || []).filter((u) => u.id !== usageId)
      });
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to remove');
    }
  };

  const openReturnModal = (u) => {
    setReturnModal({ item_id: u.item_id, item_name: u.item_name, item_quantity: u.item_quantity ?? 0 });
    setReturnSupplier('');
    setReturnQty((u.item_quantity ?? 0) > 1 ? String(u.item_quantity) : '');
  };

  const handleRequestReturn = async () => {
    if (!returnModal) return;
    const supplier = (returnSupplier || '').trim();
    if (!supplier) {
      alert('Please enter where this part was bought from (supplier).');
      return;
    }
    const qty = (returnModal.item_quantity ?? 0) > 1 ? (returnQty !== '' ? parseFloat(returnQty) : null) : null;
    if ((returnModal.item_quantity ?? 0) > 1 && (qty == null || qty < 1 || qty > (returnModal.item_quantity ?? 0))) {
      alert(`Please enter how many to return (1–${returnModal.item_quantity ?? 0}).`);
      return;
    }
    setReturnLoading(true);
    try {
      const body = { return_supplier: supplier };
      if (qty != null && qty >= 1) body.return_quantity = qty;
      await api.post(`/inventory/items/${returnModal.item_id}/request-return`, body);
      setReturnModal(null);
      setReturnSupplier('');
      setReturnQty('');
      alert('Office notified — this part is flagged for return.');
      await loadFullTaskData();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to flag for return');
    } finally {
      setReturnLoading(false);
    }
  };

  const usageList = taskData.inventory_usage || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold break-words pr-2">
              {isEditing ? 'Edit Task' : taskData.title}
            </h2>
            <div className="flex flex-wrap gap-2 shrink-0">
              {isAdmin && !isEditing && (
                <>
                  {taskData.status === 'review' && (
                    <>
                      <button
                        onClick={async () => {
                          if (confirm('Move this task back to To Do? This will allow the employee to make additional changes.')) {
                            try {
                              setLoading(true);
                              await api.put(`/tasks/${taskData.id}/status`, { status: 'todo' });
                              alert('Task moved back to To Do');
                              onClose();
                            } catch (error) {
                              alert(error.response?.data?.error || 'Failed to move task');
                            } finally {
                              setLoading(false);
                            }
                          }
                        }}
                        disabled={loading}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                      >
                        ← Move Back to To Do
                      </button>
                      <button
                        onClick={() => handleApprove(false)}
                        disabled={loading}
                        className="px-4 py-2 bg-success text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprove(true)}
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
                      >
                        Approve & Archive
                      </button>
                    </>
                  )}
                  {taskData.status === 'completed' && !taskData.is_archived && (
                    <button
                      onClick={handleArchive}
                      disabled={loading}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
          </div>

          {isEditing && isAdmin ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  onBlur={(e) => {
                    if (e.target.value) {
                      setEditData({ ...editData, title: toTitleCase(e.target.value) });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={editData.priority}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editData.category}
                    onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="PPF">PPF</option>
                    <option value="Tinting">Tinting</option>
                    <option value="Wraps">Wraps</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Upfitting">Upfitting</option>
                    <option value="Signs">Signs</option>
                    <option value="Body Work">Body Work</option>
                    <option value="Admin">Admin</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editData.due_date || ''}
                    onChange={(e) => setEditData({ ...editData, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Time (minutes)</label>
                    <input
                      type="number"
                      min="0"
                      value={editData.estimated_time_minutes || ''}
                      onChange={(e) => setEditData({ ...editData, estimated_time_minutes: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="e.g., 120 for 2 hours"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    {editData.estimated_time_minutes && (
                      <p className="text-xs text-gray-500 mt-1">
                        Estimated: {formatDuration(editData.estimated_time_minutes)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                <div className="border border-gray-300 rounded-lg p-2 max-h-48 overflow-y-auto">
                  {users.map((u) => {
                    const isSelected = (editData.assigned_users || []).includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const currentUsers = editData.assigned_users || [];
                            if (e.target.checked) {
                              setEditData({
                                ...editData,
                                assigned_users: [...currentUsers, u.id]
                              });
                            } else {
                              setEditData({
                                ...editData,
                                assigned_users: currentUsers.filter(id => id !== u.id)
                              });
                            }
                          }}
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm">{u.full_name}</span>
                      </label>
                    );
                  })}
                </div>
                {(editData.assigned_users || []).length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No users selected - task will be unassigned</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Checklist Items</label>
                <div className="space-y-2 mb-2">
                  {(editData.subtasks || []).map((subtask, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={subtask.title}
                        onChange={(e) => {
                          const newSubtasks = [...(editData.subtasks || [])];
                          newSubtasks[index].title = e.target.value;
                          setEditData({ ...editData, subtasks: newSubtasks });
                        }}
                        onBlur={(e) => {
                          if (e.target.value) {
                            const newSubtasks = [...(editData.subtasks || [])];
                            newSubtasks[index].title = toTitleCase(e.target.value);
                            setEditData({ ...editData, subtasks: newSubtasks });
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={() => handleRemoveSubtask(index)}
                        className="px-3 py-2 bg-danger text-white rounded-lg hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Add checklist item..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleAddSubtask}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Time Tracking Section (Admin Only) */}
              {isAdmin && (
                <div className="bg-primary-subtle border border-primary/20 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3">⏱️ Time Tracking (Admin Edit)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Started At</label>
                      <input
                        type="datetime-local"
                        value={editData.started_at || ''}
                        onChange={(e) => setEditData({ ...editData, started_at: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setEditData({ ...editData, started_at: '' })}
                        className="mt-1 text-xs text-primary hover:text-neutral-800"
                      >
                        Clear
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Started By</label>
                      <select
                        value={editData.started_by || ''}
                        onChange={(e) => setEditData({ ...editData, started_by: e.target.value || null })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      >
                        <option value="">None</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Completed At</label>
                      <input
                        type="datetime-local"
                        value={editData.completed_at || ''}
                        onChange={(e) => setEditData({ ...editData, completed_at: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setEditData({ ...editData, completed_at: '' })}
                        className="mt-1 text-xs text-primary hover:text-neutral-800"
                      >
                        Clear
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Completed By</label>
                      <select
                        value={editData.completed_by || ''}
                        onChange={(e) => setEditData({ ...editData, completed_by: e.target.value || null })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      >
                        <option value="">None</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {editData.started_at && editData.completed_at && (
                    <div className="mt-3 pt-3 border-t border-neutral-300 space-y-2">
                      <div>
                        <label className="text-xs font-medium text-neutral-700">Working Time</label>
                        <p className="text-sm text-neutral-900 font-semibold">
                          {calculateDuration(editData.started_at, editData.completed_at, taskData.breaks || [], taskData.active_break)}
                        </p>
                        <p className="text-xs text-primary">(Total time unpaused - excludes all pauses)</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-700">Total Duration</label>
                        <p className="text-sm text-neutral-900 font-semibold">
                          {calculateTotalDuration(editData.started_at, editData.completed_at, editData.status)}
                        </p>
                        <p className="text-xs text-primary">(From start to finish/review - includes pauses)</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-6 py-2 bg-success text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    loadFullTaskData(); // Reload to reset editData
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <p className="mt-1 text-gray-800">{taskData.description || 'No description'}</p>
              </div>
              
              {taskData.shopmonkey_order_id && (
                <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-purple-700">ShopMonkey Order</label>
                      <p className="mt-1 text-purple-800 font-semibold">
                        {taskData.shopmonkey_order_number 
                          ? `RO #${taskData.shopmonkey_order_number}` 
                          : 'Linked to ShopMonkey'}
                      </p>
                    </div>
                    <a
                      href={`https://app.shopmonkey.io/order/${taskData.shopmonkey_order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View in ShopMonkey
                    </a>
                  </div>
                </div>
              )}

              {taskData.subtasks && taskData.subtasks.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Checklist Items</label>
                  <div className="space-y-2">
                    {taskData.subtasks.map((subtask) => {
                      const checkboxId = `admin-subtask-${subtask.id}`;
                      return (
                        <label
                          key={subtask.id}
                          htmlFor={checkboxId}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                            subtask.is_completed === 1 ? 'bg-green-50' : 'bg-gray-50'
                          } hover:bg-gray-100`}
                        >
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={subtask.is_completed === 1}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSubtaskToggle(subtask.id, subtask.is_completed === 1);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 accent-primary"
                            style={{ cursor: 'pointer' }}
                          />
                          <div className="flex-1">
                            <span className={`${subtask.is_completed === 1 ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                              {subtask.title}
                            </span>
                            {subtask.is_completed === 1 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {subtask.completed_at && (
                                  <div>Completed: {formatDateTime(subtask.completed_at)}</div>
                                )}
                                {subtask.completed_by_name && (
                                  <div>by {subtask.completed_by_name}</div>
                                )}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Parts & materials linked to this task */}
              <div>
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
                  <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg relative">
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
                        {inventoryItems
                          .filter((it) => !(usageList || []).some((u) => u.item_id === it.id))
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
                {usageList.length === 0 && !showAddInventory && (
                  <p className="text-gray-500 text-sm">No parts or materials linked yet.</p>
                )}
                {usageList.length > 0 && (
                  <ul className="space-y-2">
                    {usageList.map((u) => (
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
                        {!(u.needs_return && !u.returned_at) ? (
                          <button type="button" onClick={() => openReturnModal(u)} className="text-xs px-2 py-1 border border-orange-400 text-orange-700 rounded hover:bg-orange-50" title="Flag for return">Return</button>
                        ) : (
                          <span className="text-xs text-amber-600">Flagged for return</span>
                        )}
                        <button type="button" onClick={() => handleRemoveInventoryUsage(u.id)} className="text-red-600 hover:text-red-800 text-sm" title="Remove from task">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Parts Used (scan-to-use) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-medium text-gray-700">Parts Used (scanned)</label>
                  <button
                    type="button"
                    onClick={() => setShowPartScanner(true)}
                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    + Add Part
                  </button>
                </div>
                {partsLoading ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : partsUsed.length === 0 ? (
                  <p className="text-sm text-gray-500">No parts scanned onto this task yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {partsUsed.map((u) => (
                      <li key={u.id} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-sm">
                        <span className="font-medium flex-1 min-w-0 truncate">{u.item_name}</span>
                        <span className="text-xs text-gray-500">{u.quantity_used} {u.item_unit || 'ea'}</span>
                        {u.used_by_name && <span className="text-xs text-gray-400">by {u.used_by_name}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <BarcodeScannerModal
                  isOpen={showPartScanner}
                  onClose={() => setShowPartScanner(false)}
                  pendingContext={{ type: 'use_on_task', task_id: task.id, task_title: taskData.title }}
                  onDetected={() => { loadPartsUsed(); }}
                />
              </div>

              {/* Job Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
                <TaskPhotos taskId={task.id} isAdmin={isAdmin} />
              </div>

              {/* AI Quality Checks */}
              {qualityChecks && qualityChecks.length > 0 && taskData.status !== 'completed' && (
                <div className="mt-4 p-3 bg-primary-subtle border border-primary/20 rounded-lg">
                  <label className="text-sm font-medium text-neutral-700 mb-2 block">
                    🤖 AI Quality Check Suggestions
                  </label>
                  <ul className="space-y-1">
                    {qualityChecks.map((check, index) => (
                      <li key={index} className="text-sm text-neutral-800 flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{check}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Recommendations */}
              {recommendations && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <label className="text-sm font-medium text-green-700 mb-2 block">
                    🤖 AI Recommendations
                  </label>
                  {recommendations.parts && recommendations.parts.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-green-800 mb-1">Parts:</p>
                      <ul className="space-y-1">
                        {recommendations.parts.map((part, index) => (
                          <li key={index} className="text-sm text-green-800">
                            • {part.name} {part.quantity > 1 && `(Qty: ${part.quantity})`}
                            {part.notes && <span className="text-xs text-green-600"> - {part.notes}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recommendations.labor && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-green-800 mb-1">Labor:</p>
                      <p className="text-sm text-green-800">
                        Estimated: {recommendations.labor.estimatedHours} hours
                        {recommendations.labor.skillLevel && ` (${recommendations.labor.skillLevel} level)`}
                        {recommendations.labor.notes && (
                          <span className="block text-xs text-green-600 mt-1">{recommendations.labor.notes}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {recommendations.tools && recommendations.tools.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-green-800 mb-1">Tools:</p>
                      <p className="text-sm text-green-800">{recommendations.tools.join(', ')}</p>
                    </div>
                  )}
                  {recommendations.notes && (
                    <div>
                      <p className="text-xs font-semibold text-green-800 mb-1">Notes:</p>
                      <p className="text-sm text-green-800">{recommendations.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Work Status Indicators and Action Buttons (Admin View) */}
              {isAdmin && (
                <div className="mb-4 space-y-3">
                  <div className="p-3 rounded-lg border-2">
                    {taskData.active_break ? (
                      <div className="flex items-center gap-2 text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                        <span className="text-lg">⏸️</span>
                        <div className="flex-1">
                          <p className="font-semibold">On Pause</p>
                          <p className="text-xs text-orange-600">
                            Pause started: {formatDateTime(taskData.active_break.break_start)}
                            {taskData.active_break.reason && ` - ${taskData.active_break.reason}`}
                          </p>
                        </div>
                      </div>
                    ) : taskData.status === 'in_progress' && taskData.started_at && !taskData.completed_at ? (
                      <div className="flex items-center gap-2 text-neutral-700 bg-primary-subtle border border-primary/20 rounded p-2">
                        <span className="w-3 h-3 bg-primary rounded-full animate-pulse"></span>
                        <div className="flex-1">
                          <p className="font-semibold">Currently Being Worked On</p>
                          <p className="text-xs text-primary">
                            Started: {formatDateTime(taskData.started_at)}
                            {taskData.started_by_name && ` by ${taskData.started_by_name}`}
                          </p>
                          {taskData.last_restarted_at && (
                            <p className="text-xs text-primary mt-1">
                              Last restarted: {formatDateTime(taskData.last_restarted_at)}
                              {taskData.last_restarted_by && ` by ${taskData.last_restarted_by}`}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : taskData.status === 'in_progress' ? (
                      <div className="flex items-center gap-2 text-gray-700 bg-gray-50 border border-gray-200 rounded p-2">
                        <span className="text-sm">📋</span>
                        <p className="text-sm">In Progress (Not Started)</p>
                      </div>
                    ) : null}
                  </div>

                  {/* Action Buttons */}
                  {!isEditing && taskData.status !== 'completed' && taskData.status !== 'review' && (
                    <div className="flex flex-wrap gap-2">
                      {!taskData.started_at && (
                        <button
                          onClick={handleStartTask}
                          disabled={loading}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50 flex items-center gap-2 text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Start Task
                        </button>
                      )}
                      {taskData.started_at && !taskData.completed_at && (
                        <>
                          {!taskData.active_break ? (
                            <button
                              onClick={() => setShowPauseModal(true)}
                              disabled={loading}
                              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2 text-sm"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pause Task
                            </button>
                          ) : (
                            <button
                              onClick={handleEndPause}
                              disabled={loading}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Resume Task
                            </button>
                          )}
                          <button
                            onClick={handleCompleteTask}
                            disabled={loading}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 flex items-center gap-2 text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Complete Task
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className="mt-1 capitalize">{taskData.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Priority</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded text-sm ${getPriorityColor(taskData.priority)} text-white`}>
                      {taskData.priority}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded text-sm ${getCategoryColor(taskData.category)}`}>
                      {taskData.category}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Due Date</label>
                  <p className={`mt-1 ${taskData.due_date ? getDueDateColor(taskData.due_date) : 'text-gray-800'}`}>
                    {formatDate(taskData.due_date) || 'No due date'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Assigned To</label>
                  <p className="mt-1 text-gray-800">
                    {taskData.assigned_users && taskData.assigned_users.length > 0
                      ? taskData.assigned_users.map(u => u.full_name).join(', ')
                      : (taskData.assigned_to_name || 'Unassigned')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-gray-800">{formatDateTime(taskData.created_at)}</p>
                </div>
              </div>

              {/* Time Tracking Section - Always show for all tasks */}
              <div className="bg-primary-subtle border border-primary/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">⏱️ Time Tracking</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {taskData.started_at ? (
                    <div>
                      <label className="text-xs font-medium text-neutral-700">Started</label>
                      <p className="mt-1 text-neutral-900">
                        {formatDateTime(taskData.started_at)}
                        {taskData.started_by_name && (
                          <span className="text-primary"> by {taskData.started_by_name}</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-neutral-700">Started</label>
                      <p className="mt-1 text-gray-500 italic">Not started yet</p>
                    </div>
                  )}
                  {taskData.completed_at ? (
                    <div>
                      <label className="text-xs font-medium text-neutral-700">Completed</label>
                      <p className="mt-1 text-neutral-900">
                        {formatDateTime(taskData.completed_at)}
                        {taskData.completed_by_name && (
                          <span className="text-primary"> by {taskData.completed_by_name}</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-neutral-700">Completed</label>
                      <p className="mt-1 text-gray-500 italic">Not completed yet</p>
                    </div>
                  )}
                  {taskData.started_at ? (
                    <div className="col-span-2 space-y-2">
                      <div>
                        <label className="text-xs font-medium text-neutral-700">Total Working Time</label>
                        <p className="mt-1 text-neutral-900 font-semibold">
                          {calculateDuration(taskData.started_at, taskData.completed_at, taskData.breaks || [], taskData.active_break) || 'In progress...'}
                        </p>
                        <p className="text-xs text-primary mt-0.5">(Total time task has been unpaused - excludes all pauses)</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-700">Total Duration</label>
                        <p className="mt-1 text-neutral-900 font-semibold">
                          {calculateTotalDuration(taskData.started_at, taskData.completed_at, taskData.status) || 'In progress...'}
                        </p>
                        <p className="text-xs text-primary mt-0.5">(How long the task took from start to finish/review - includes pauses)</p>
                      </div>
                      {taskData.estimated_time_minutes && taskData.completed_at && (
                        <div className="mt-2 pt-2 border-t border-neutral-300">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-700">Estimated:</span>
                            <span className="text-neutral-900">{formatDuration(taskData.estimated_time_minutes)}</span>
                          </div>
                          {(() => {
                            // Calculate actual duration excluding pauses
                            const actualMinutes = calculateDurationMinutes(
                              taskData.started_at, 
                              taskData.completed_at, 
                              taskData.breaks || [],
                              taskData.active_break
                            );
                            const estimatedMinutes = taskData.estimated_time_minutes;
                            if (!estimatedMinutes || actualMinutes < 0) return null;
                            
                            const diff = actualMinutes - estimatedMinutes;
                            const diffPercent = Math.round((diff / estimatedMinutes) * 100);
                            return (
                              <div className="flex justify-between items-center text-xs mt-1">
                                <span className="text-neutral-700">Difference:</span>
                                <span className={diff > 0 ? 'text-red-600 font-semibold' : diff < 0 ? 'text-green-600 font-semibold' : 'text-neutral-900'}>
                                  {diff > 0 ? '+' : ''}{formatDuration(Math.abs(diff))} ({diffPercent > 0 ? '+' : ''}{diffPercent}%)
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="col-span-2">
                      {taskData.estimated_time_minutes ? (
                        <div>
                          <label className="text-xs font-medium text-neutral-700">Estimated Time</label>
                          <p className="mt-1 text-neutral-900 font-semibold">
                            {formatDuration(taskData.estimated_time_minutes)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">Time tracking will begin when task is started</p>
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs font-medium text-neutral-700">Time Tracking</label>
                          <p className="mt-1 text-gray-500 italic">No time tracking data yet. Start the task to begin tracking.</p>
                          {isAdmin && (
                            <p className="text-xs text-gray-500 mt-1">As admin, you can manually set start/completion times in edit mode.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {taskData.status === 'review' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-800">
                    ⚠️ This task is pending your approval
                  </p>
                  {taskData.torqued_to_spec === 1 && (
                    <p className="text-xs text-yellow-600 mt-1">✓ Employee confirmed torqued to spec</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Comments</label>
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
                    placeholder="Add a comment..."
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

              {/* Share Status Link (Admin Only) */}
              {isAdmin && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-3">🔗 Share Status with Customer</h3>
                  <div className="space-y-2 mb-3">
                    <input
                      type="text"
                      value={shareCustomerName}
                      onChange={(e) => setShareCustomerName(e.target.value)}
                      placeholder="Customer name (optional)"
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                    />
                    <input
                      type="tel"
                      value={shareCustomerPhone}
                      onChange={(e) => setShareCustomerPhone(e.target.value)}
                      placeholder="Customer phone (optional)"
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <button
                    onClick={handleGenerateShareLink}
                    disabled={shareLoading}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50"
                  >
                    {shareLoading ? 'Generating…' : 'Generate Link'}
                  </button>
                  {shareUrl && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-white border border-amber-200 rounded-lg">
                        <span className="flex-1 text-xs text-gray-700 break-all">{shareUrl}</span>
                        <button
                          onClick={() => navigator.clipboard?.writeText(shareUrl)}
                          className="shrink-0 px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition"
                        >
                          Copy
                        </button>
                      </div>
                      {shareCustomerPhone && (
                        <a
                          href={`sms:${shareCustomerPhone}?body=${encodeURIComponent('Track your vehicle at ' + shareUrl)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                        >
                          📱 Send SMS
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {history.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700">History</label>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {history.map((item) => (
                      <div key={item.id} className="text-xs text-gray-600">
                        {item.changed_by_name} changed {item.field_changed} from "{item.old_value}" to "{item.new_value}" at {formatDateTime(item.changed_at)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Return part/fluid modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4" onClick={() => setReturnModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Flag for return</h3>
              <button type="button" onClick={() => setReturnModal(null)} className="p-1 rounded hover:bg-gray-100 text-gray-600" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-medium text-gray-900">{returnModal.item_name}</span> — Where was this bought from? Office will be notified to return it.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (required)</label>
                <input
                  type="text"
                  value={returnSupplier}
                  onChange={(e) => setReturnSupplier(e.target.value)}
                  placeholder="e.g. AutoZone, NAPA, Amazon"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  autoFocus
                />
              </div>
              {returnModal.item_quantity > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">How many to return?</label>
                  <input
                    type="number"
                    min={1}
                    max={returnModal.item_quantity}
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value)}
                    placeholder={`1–${returnModal.item_quantity}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-0.5">You have {returnModal.item_quantity} in inventory.</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setReturnModal(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={handleRequestReturn} disabled={returnLoading || !returnSupplier.trim()} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {returnLoading ? 'Sending…' : 'Flag for return'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Pause Task</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Pause <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g., Lunch, Pulled to work on another car"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && pauseReason.trim()) {
                      handleStartPause();
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleStartPause}
                  disabled={loading || !pauseReason.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {loading ? 'Pausing...' : 'Start Pause'}
                </button>
                <button
                  onClick={() => {
                    setShowPauseModal(false);
                    setPauseReason('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
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
};

export default TaskModal;

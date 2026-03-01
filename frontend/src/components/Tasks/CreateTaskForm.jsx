import React, { useState } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { toTitleCase } from '../../utils/helpers';
import axios from 'axios';
import ShopMonkeyItemSelector from './ShopMonkeyItemSelector';

const CreateTaskForm = ({ onClose }) => {
  // FORCE ALERT TO VERIFY CODE IS LOADED - TEMPORARY TEST
  React.useEffect(() => {
    if (!window.__createTaskFormLoaded) {
      window.__createTaskFormLoaded = true;
      console.log('🚀🚀🚀 CreateTaskForm component loaded - VERSION 2.0');
      console.log('🚀🚀🚀 If you see this, the NEW code is running!');
      // TEMPORARY: Force alert to verify code is loaded
      setTimeout(() => {
        alert('✅ NEW CODE LOADED - VERSION 2.0\n\nIf you see this alert, the new code is running!\n\nCheck console for 🚀 logs when you click Import.');
      }, 1000);
    }
  }, []);
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    assigned_users: [],
    status: 'todo',
    priority: 'medium',
    category: 'Other',
    due_date: '',
    estimated_time_minutes: '',
    subtasks: [],
    shopmonkey_order_id: null,
    shopmonkey_order_number: null
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [showShopMonkey, setShowShopMonkey] = useState(false);
  const [shopmonkeyOrders, setShopmonkeyOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [shopmonkeySearch, setShopmonkeySearch] = useState('');
  const [estimatingTime, setEstimatingTime] = useState(false);
  const [aiEstimate, setAiEstimate] = useState(null);
  const [categorizing, setCategorizing] = useState(false);
  const [suggestedAssignment, setSuggestedAssignment] = useState(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [parsedShopMonkeyData, setParsedShopMonkeyData] = useState(null);

  React.useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers((Array.isArray(response.data.users) ? response.data.users : []).filter(u => u.is_active));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setFormData({
      ...formData,
      subtasks: [...formData.subtasks, { title: newSubtask }]
    });
    setNewSubtask('');
  };

  const handleRemoveSubtask = (index) => {
    const newSubtasks = [...formData.subtasks];
    newSubtasks.splice(index, 1);
    setFormData({ ...formData, subtasks: newSubtasks });
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingPdf(true);
    setPdfFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      // Get API base URL
      const getApiBaseUrl = () => {
        if (import.meta.env.VITE_API_URL) {
          return import.meta.env.VITE_API_URL;
        }
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const hostname = window.location.hostname;
        return `${protocol}//${hostname}:5000/api`;
      };

      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');

      const response = await axios.post(`${API_BASE_URL}/pdf/parse`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        withCredentials: true
      });

      const { workItems, vehicleInfo } = response.data;

      if (workItems && workItems.length > 0) {
        // Convert work items to subtasks
        const extractedSubtasks = workItems.map(item => ({
          title: item.title
        }));

        // Update form with extracted data
        setFormData(prev => ({
          ...prev,
          subtasks: [...prev.subtasks, ...extractedSubtasks],
          // Auto-fill title if empty and we have vehicle info
          title: prev.title || (vehicleInfo.repairOrderNumber 
            ? `Repair Order #${vehicleInfo.repairOrderNumber}` 
            : ''),
          // Auto-fill description with vehicle info if available
          description: prev.description || (vehicleInfo.year && vehicleInfo.make && vehicleInfo.model
            ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}${vehicleInfo.vin ? ` (VIN: ${vehicleInfo.vin})` : ''}${vehicleInfo.mileage ? ` - ${vehicleInfo.mileage} miles` : ''}`
            : '')
        }));

        alert(`Successfully extracted ${workItems.length} work items from PDF!`);
      } else {
        alert('No work items found in PDF. Please add items manually.');
      }
    } catch (error) {
      console.error('PDF upload error:', error);
      alert(error.response?.data?.error || 'Failed to parse PDF. Please try again.');
    } finally {
      setUploadingPdf(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleShopMonkeySearch = async () => {
    setLoadingOrders(true);
    try {
      const response = await api.get('/shopmonkey/orders', {
        params: {
          limit: 20,
          workflowStatus: 'inShop' // Filter for "in the shop" orders
        }
      });
      setShopmonkeyOrders(response.data.orders || []);
    } catch (error) {
      console.error('ShopMonkey search error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to fetch repair orders from ShopMonkey';
      if (errorMessage.includes('API key not configured')) {
        alert('ShopMonkey API key not configured.\n\nPlease add SHOPMONKEY_API_KEY to backend/.env file and restart the server.');
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleImportFromShopMonkey = async (orderId) => {
    console.log('🚀🚀🚀 handleImportFromShopMonkey CALLED with orderId:', orderId);
    console.log('🚀🚀🚀 This is the NEW CODE - if you see this, the code is running!');
    
    setLoadingOrders(true);
    try {
      console.log('🚀 Making API call to parse order...');
      const response = await api.post(`/shopmonkey/orders/${orderId}/parse`);
      console.log('🚀 API response received:', response);
      
      const { workItems, vehicleInfo, order } = response.data;

      console.log('🚀 ShopMonkey parse response:', { workItems, vehicleInfo, order });
      console.log('🚀 Work items count:', workItems?.length || 0);
      console.log('🚀 Work items:', workItems);

      // ALWAYS show selection modal, even with 0 items (so user can see what happened)
      console.log('🚀✅ NEW CODE: Setting parsedShopMonkeyData and showing selector');
      console.log('🚀 Work items to show:', workItems);
      console.log('🚀 Work items count:', workItems?.length || 0);
      
      const dataToSet = { workItems: workItems || [], vehicleInfo, order };
      console.log('🚀 Setting parsedShopMonkeyData:', dataToSet);
      
      setParsedShopMonkeyData(dataToSet);
      setShowItemSelector(true);
      setShowShopMonkey(false);
      
      console.log('🚀✅ NEW CODE: showItemSelector set to true');
      console.log('🚀✅ NEW CODE: showShopMonkey set to false');
      console.log('🚀✅ Modal should now be visible!');
      
      if (!workItems || workItems.length === 0) {
        console.warn('🚀⚠️ No work items found - showing empty modal');
      } else {
        console.log(`🚀✅ NEW CODE: Will show modal with ${workItems.length} items`);
      }
    } catch (error) {
      console.error('🚀❌ ShopMonkey import error:', error);
      console.error('🚀❌ Error details:', error.response?.data || error.message);
      alert(error.response?.data?.error || 'Failed to import from ShopMonkey');
    } finally {
      setLoadingOrders(false);
      console.log('🚀 Finished handleImportFromShopMonkey');
    }
  };

  const handleConfirmSelectedItems = (selectedItems) => {
    if (!selectedItems || selectedItems.length === 0) {
      alert('Please select at least one item to import.');
      return;
    }

    const extractedSubtasks = selectedItems.map(item => ({
      title: item.title
    }));

    const { vehicleInfo, order } = parsedShopMonkeyData;

    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, ...extractedSubtasks],
      title: prev.title || (order.number 
        ? `Repair Order #${order.number}` 
        : ''),
      description: prev.description || (vehicleInfo.year && vehicleInfo.make && vehicleInfo.model
        ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}${vehicleInfo.vin ? ` (VIN: ${vehicleInfo.vin})` : ''}${vehicleInfo.mileage ? ` - ${vehicleInfo.mileage} miles` : ''}${vehicleInfo.customerName ? ` - ${vehicleInfo.customerName}` : ''}`
        : ''),
      shopmonkey_order_id: order.id,
      shopmonkey_order_number: order.number
    }));

    setShowItemSelector(false);
    setParsedShopMonkeyData(null);
    alert(`Successfully imported ${selectedItems.length} work item${selectedItems.length === 1 ? '' : 's'} from ShopMonkey Repair Order #${order.number}!`);
  };

  const handleCancelItemSelection = () => {
    setShowItemSelector(false);
    setParsedShopMonkeyData(null);
  };

  const handleAIEstimate = async () => {
    if (!formData.title) {
      alert('Please enter a task title first');
      return;
    }

    setEstimatingTime(true);
    try {
      const response = await api.post('/tasks/estimate-time', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        subtasks: formData.subtasks
      });

      if (response.data.estimatedMinutes) {
        setAiEstimate(response.data);
        setFormData(prev => ({
          ...prev,
          estimated_time_minutes: response.data.estimatedMinutes
        }));
      }
    } catch (error) {
      console.error('AI estimation error:', error);
      if (error.response?.status !== 400) {
        alert(error.response?.data?.error || 'Failed to get AI estimate');
      }
    } finally {
      setEstimatingTime(false);
    }
  };

  const handleSuggestAssignment = async () => {
    if (!formData.title) {
      alert('Please enter a task title first');
      return;
    }

    // Note: Assignment suggestions require a task ID, so this feature
    // is available after task creation in the task detail view
    alert('Assignment suggestions are available after creating the task. You can get AI suggestions from the task detail page.');
  };

  // Auto-categorize when title/description changes
  React.useEffect(() => {
    if (formData.title && !formData.category && user?.role === 'admin') {
      const timer = setTimeout(async () => {
        setCategorizing(true);
        try {
          const response = await api.post('/tasks/categorize', {
            title: formData.title,
            description: formData.description
          });
          if (response.data.category) {
            setFormData(prev => ({
              ...prev,
              category: response.data.category
            }));
          }
        } catch (error) {
          // Silently fail - user can set category manually
          console.warn('Auto-categorization failed:', error);
        } finally {
          setCategorizing(false);
        }
      }, 1000); // Debounce 1 second

      return () => clearTimeout(timer);
    }
  }, [formData.title, formData.description]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    setLoading(true);
    try {
      await api.post('/tasks', formData);
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col" style={{ zIndex: 10001 }} onClick={(e) => e.stopPropagation()}>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">Create New Task</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
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
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, title: value });
                }}
                onBlur={(e) => {
                  if (e.target.value) {
                    setFormData({ ...formData, title: toTitleCase(e.target.value) });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign To
                  {suggestedAssignment && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          assigned_users: [suggestedAssignment.suggestedEmployeeId],
                          assigned_to: suggestedAssignment.suggestedEmployeeId
                        });
                      }}
                      className="ml-2 text-xs text-purple-600 hover:text-purple-800 underline"
                    >
                      Use AI suggestion: {suggestedAssignment.suggestedEmployeeName}
                    </button>
                  )}
                </label>
                {suggestedAssignment && (
                  <div className="mb-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                    <p className="font-semibold text-purple-700">AI Suggestion:</p>
                    <p className="text-purple-600">{suggestedAssignment.reasoning}</p>
                  </div>
                )}
                <div className="border border-gray-300 rounded-lg p-2 max-h-48 overflow-y-auto" style={{ position: 'relative', zIndex: 10002 }}>
                  {users.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">Loading users...</p>
                  ) : (
                    users.map((u) => {
                      const isSelected = (formData.assigned_users || []).includes(u.id);
                      const isAISuggested = suggestedAssignment?.suggestedEmployeeId === u.id;
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer ${isAISuggested ? 'bg-purple-50' : ''}`}
                          style={{ position: 'relative', zIndex: 10003 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              const currentUsers = formData.assigned_users || [];
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  assigned_users: [...currentUsers, u.id],
                                  assigned_to: u.id // Keep for backward compatibility
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  assigned_users: currentUsers.filter(id => id !== u.id),
                                  assigned_to: currentUsers.length === 1 && currentUsers[0] === u.id ? '' : formData.assigned_to
                                });
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                          <span className="text-sm">{u.full_name}</span>
                          {isAISuggested && (
                            <span className="ml-auto text-xs text-purple-600">🤖 Suggested</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
                {(formData.assigned_users || []).length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No users selected - task will be unassigned</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                  {categorizing && (
                    <span className="ml-2 text-xs text-purple-600">AI categorizing...</span>
                  )}
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Time (minutes)
                    {aiEstimate && (
                      <span className="ml-2 text-xs text-purple-600">
                        AI: {aiEstimate.estimatedMinutes} min ({aiEstimate.confidence})
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      value={formData.estimated_time_minutes}
                      onChange={(e) => setFormData({ ...formData, estimated_time_minutes: e.target.value ? parseInt(e.target.value) : '' })}
                      placeholder="e.g., 120 for 2 hours"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleAIEstimate}
                      disabled={estimatingTime || !formData.title}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:opacity-50 text-sm"
                    >
                      {estimatingTime ? '...' : '🤖 AI Estimate'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Import Work Order (Optional)
              </label>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowShopMonkey(!showShopMonkey);
                    if (!showShopMonkey && shopmonkeyOrders.length === 0) {
                      handleShopMonkeySearch();
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm font-medium"
                >
                  {showShopMonkey ? 'Hide ShopMonkey' : '📋 Import from ShopMonkey'}
                </button>
              </div>
              
              {showShopMonkey && (
                <div className="mb-4 p-4 border border-gray-300 rounded-lg bg-gray-50">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Search repair orders..."
                      value={shopmonkeySearch}
                      onChange={(e) => setShopmonkeySearch(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleShopMonkeySearch}
                      disabled={loadingOrders}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm disabled:opacity-50"
                    >
                      {loadingOrders ? 'Loading...' : 'Search'}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {loadingOrders ? (
                      <p className="text-sm text-gray-500 text-center py-4">Loading repair orders...</p>
                    ) : shopmonkeyOrders.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No repair orders found</p>
                    ) : (
                      shopmonkeyOrders
                        .filter(order => 
                          !shopmonkeySearch || 
                          order.number?.toString().includes(shopmonkeySearch) ||
                          order.vehicle?.make?.toLowerCase().includes(shopmonkeySearch.toLowerCase()) ||
                          order.vehicle?.model?.toLowerCase().includes(shopmonkeySearch.toLowerCase())
                        )
                        .map(order => (
                          <div
                            key={order.id}
                            className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              console.log('🚀🚀🚀 Order card clicked for order:', order.id);
                              console.log('🚀🚀🚀 Calling handleImportFromShopMonkey...');
                              handleImportFromShopMonkey(order.id);
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-sm">RO #{order.number}</p>
                                {order.vehicle && (
                                  <p className="text-xs text-gray-600">
                                    {order.vehicle.year} {order.vehicle.make} {order.vehicle.model}
                                  </p>
                                )}
                                {order.customer && (
                                  <p className="text-xs text-gray-500">{order.customer.name}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                className="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleImportFromShopMonkey(order.id);
                                }}
                              >
                                Import
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
              
              <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">
                Or Upload Work Order PDF
              </label>
              <div className="mb-4">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploadingPdf ? (
                      <>
                        <svg className="w-8 h-8 mb-2 text-gray-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <p className="mb-2 text-sm text-gray-500">Parsing PDF...</p>
                      </>
                    ) : (
                      <>
                        <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PDF work order (MAX. 10MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfUpload}
                    disabled={uploadingPdf}
                  />
                </label>
                {pdfFileName && !uploadingPdf && (
                  <p className="mt-2 text-sm text-gray-600">
                    ✓ {pdfFileName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Checklist Items (Optional)
              </label>
              <div className="space-y-2 mb-2 max-h-48 overflow-y-auto">
                {formData.subtasks.map((subtask, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex-1 px-3 py-2 bg-gray-50 rounded-lg">{subtask.title}</span>
                    <button
                      type="button"
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
                  onBlur={(e) => {
                    if (e.target.value) {
                      setNewSubtask(toTitleCase(e.target.value));
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newSubtask.trim()) {
                        const titleCased = toTitleCase(newSubtask);
                        setFormData({
                          ...formData,
                          subtasks: [...formData.subtasks, { title: titleCased }]
                        });
                        setNewSubtask('');
                      }
                    }
                  }}
                  placeholder="Add checklist item..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>

            {(() => {
              const shouldRender = showItemSelector && parsedShopMonkeyData;
              console.log('🔍 Modal render check:', { 
                showItemSelector, 
                hasParsedData: !!parsedShopMonkeyData,
                shouldRender,
                parsedDataKeys: parsedShopMonkeyData ? Object.keys(parsedShopMonkeyData) : null
              });
              return shouldRender ? (
                <ShopMonkeyItemSelector
                  key={`selector-${parsedShopMonkeyData.order?.id || Date.now()}`}
                  workItems={parsedShopMonkeyData.workItems || []}
                  vehicleInfo={parsedShopMonkeyData.vehicleInfo || {}}
                  order={parsedShopMonkeyData.order || {}}
                  onConfirm={handleConfirmSelectedItems}
                  onCancel={handleCancelItemSelection}
                />
              ) : null;
            })()}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskForm;


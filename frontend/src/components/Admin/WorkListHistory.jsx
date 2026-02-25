import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const WorkListHistory = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    category: 'all'
  });

  useEffect(() => {
    loadHistory();
  }, [filters]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.category !== 'all') params.append('category', filters.category);

      const response = await api.get(`/admin/worklist/history?${params.toString()}`);
      setHistory(response.data.history || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-2xl font-semibold text-gray-800">Completion History</h2>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Categories</option>
              <option value="time_approval">Time Approval</option>
              <option value="task_review">Task Review</option>
              <option value="compliance">Compliance</option>
              <option value="inventory">Inventory</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed At</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time Taken</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No completion history found for the selected period
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.category ? getCategoryLabel(entry.category) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.completed_by_name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(entry.completed_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.time_taken_minutes ? `${entry.time_taken_minutes} min` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.notes || '-'}</td>
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

export default WorkListHistory;

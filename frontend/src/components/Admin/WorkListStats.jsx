import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const WorkListStats = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadStats();
  }, [filters]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await api.get(`/admin/worklist/stats?${params.toString()}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-8 text-gray-500">No statistics available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-2xl font-semibold text-gray-800">Statistics</h2>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
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
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Items</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.totalItems || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{stats.completedItems || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Completion Rate</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.completionRate || 0}%</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Avg Time</h3>
          <p className="text-3xl font-bold text-purple-600">
            {stats.averageTimeMinutes ? `${Math.round(stats.averageTimeMinutes)}m` : '-'}
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      {stats.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {stats.categoryBreakdown.map((cat) => {
              const completionRate = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
              return (
                <div key={cat.category}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {getCategoryLabel(cat.category)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {cat.completed} / {cat.total} ({completionRate}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Priority Breakdown */}
      {stats.priorityBreakdown && stats.priorityBreakdown.length > 0 && (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Priority Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.priorityBreakdown.map((pri) => {
              const completionRate = pri.total > 0 ? Math.round((pri.completed / pri.total) * 100) : 0;
              return (
                <div key={pri.priority} className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{pri.completed}</p>
                  <p className="text-sm text-gray-600">of {pri.total}</p>
                  <p className="text-xs text-gray-500 capitalize mt-1">{pri.priority}</p>
                  <p className="text-xs text-blue-600 mt-1">{completionRate}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Most Time-Consuming Items */}
      {stats.timeConsumingItems && stats.timeConsumingItems.length > 0 && (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Most Time-Consuming Items</h3>
          <div className="space-y-2">
            {stats.timeConsumingItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-neutral-950 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">{item.title}</p>
                  <p className="text-sm text-gray-600">
                    {item.category ? getCategoryLabel(item.category) : 'General'}
                    {item.completed_by_name && ` • ${item.completed_by_name}`}
                  </p>
                </div>
                <p className="text-lg font-bold text-purple-600">{item.actual_minutes}m</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkListStats;

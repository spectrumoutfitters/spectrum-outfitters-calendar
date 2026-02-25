import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatTime } from '../../utils/helpers';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [weekEnding, setWeekEnding] = useState(() => {
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + (7 - today.getDay()));
    return weekEnd.toISOString().split('T')[0];
  });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Report data states
  const [overview, setOverview] = useState(null);
  const [timeReport, setTimeReport] = useState(null);
  const [taskReport, setTaskReport] = useState(null);
  const [employeePerformance, setEmployeePerformance] = useState(null);

  useEffect(() => {
    loadUsers();
    if (activeTab === 'overview') {
      loadOverview();
    } else if (activeTab === 'time') {
      loadTimeReport();
    } else if (activeTab === 'tasks') {
      loadTaskReport();
    } else if (activeTab === 'performance') {
      loadEmployeePerformance();
    }
  }, [activeTab, dateRange, weekEnding, selectedUserId]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.users.filter(u => u.is_active));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadOverview = async () => {
    setLoading(true);
    try {
      // Load multiple data sources for overview
      const [timeRes, taskRes, perfRes] = await Promise.all([
        api.get('/time/report', { params: { week_ending_date: weekEnding } }).catch(() => null),
        api.get('/tasks', { params: { include_archived: false } }).catch(() => null),
        api.get('/analytics/employee-performance', { 
          params: { start_date: dateRange.start, end_date: dateRange.end } 
        }).catch(() => null)
      ]);

      const overviewData = {
        time: timeRes?.data || null,
        tasks: taskRes?.data || null,
        performance: perfRes?.data || null
      };
      setOverview(overviewData);
    } catch (error) {
      console.error('Error loading overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeReport = async () => {
    setLoading(true);
    try {
      const params = { week_ending_date: weekEnding };
      if (selectedUserId) params.user_id = selectedUserId;
      const response = await api.get('/time/report', { params });
      setTimeReport(response.data);
    } catch (error) {
      console.error('Error loading time report:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTaskReport = async () => {
    setLoading(true);
    try {
      const params = { include_archived: false };
      if (selectedUserId) params.assigned_to = selectedUserId;
      const response = await api.get('/tasks', { params });
      setTaskReport(response.data);
    } catch (error) {
      console.error('Error loading task report:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeePerformance = async () => {
    setLoading(true);
    try {
      const params = { start_date: dateRange.start, end_date: dateRange.end };
      if (selectedUserId) params.user_id = selectedUserId;
      const response = await api.get('/analytics/employee-performance', { params });
      setEmployeePerformance(response.data);
    } catch (error) {
      console.error('Error loading performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data, filename) => {
    if (!data || !data.length) return;

    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => `"${row[header] || ''}"`).join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'time', label: '⏰ Time & Payroll', icon: '⏰' },
    { id: 'tasks', label: '✅ Tasks', icon: '✅' },
    { id: 'performance', label: '👥 Employee Performance', icon: '👥' }
  ];

  // Calculate overview stats
  const calculateOverviewStats = () => {
    if (!overview) return null;

    const stats = {
      totalHours: 0,
      totalPay: 0,
      activeEmployees: 0,
      tasksCompleted: 0,
      tasksInProgress: 0,
      avgTaskCompletion: 0
    };

    // Time stats
    if (overview.time?.report) {
      const timeData = overview.time.report;
      stats.totalHours = timeData.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
      stats.totalPay = timeData.reduce((sum, e) => sum + parseFloat(e.pay || 0), 0);
      stats.activeEmployees = new Set(timeData.map(e => e.user_id)).size;
    }

    // Task stats
    if (overview.tasks?.tasks) {
      const tasks = overview.tasks.tasks;
      stats.tasksCompleted = tasks.filter(t => t.status === 'completed').length;
      stats.tasksInProgress = tasks.filter(t => t.status === 'in_progress').length;
      const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at);
      if (completedTasks.length > 0) {
        const totalDuration = completedTasks.reduce((sum, t) => {
          if (t.started_at && t.completed_at) {
            const duration = (new Date(t.completed_at) - new Date(t.started_at)) / (1000 * 60 * 60);
            return sum + duration;
          }
          return sum;
        }, 0);
        stats.avgTaskCompletion = totalDuration / completedTasks.length;
      }
    }

    return stats;
  };

  const overviewStats = calculateOverviewStats();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Company Reports</h2>
        <div className="flex gap-2">
          {activeTab === 'time' && (
            <>
              <input
                type="date"
                value={weekEnding}
                onChange={(e) => setWeekEnding(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
              />
            </>
          )}
          {(activeTab === 'tasks' || activeTab === 'performance') && (
            <>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
              />
              <span className="self-center text-gray-500 dark:text-neutral-400">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
              />
            </>
          )}
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
          >
            <option value="">All Employees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-neutral-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:border-gray-300 dark:hover:border-neutral-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 dark:text-neutral-300">Loading report data...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && overviewStats && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-neutral-300">Total Hours</p>
                      <p className="text-3xl font-bold text-blue-600">{overviewStats.totalHours.toFixed(1)}</p>
                    </div>
                    <div className="text-4xl">⏰</div>
                  </div>
                </div>
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-neutral-300">Total Payroll</p>
                      <p className="text-3xl font-bold text-red-600">${overviewStats.totalPay.toFixed(2)}</p>
                    </div>
                    <div className="text-4xl">💰</div>
                  </div>
                </div>
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-neutral-300">Active Employees</p>
                      <p className="text-3xl font-bold text-purple-600">{overviewStats.activeEmployees}</p>
                    </div>
                    <div className="text-4xl">👥</div>
                  </div>
                </div>
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-neutral-300">Tasks Completed</p>
                      <p className="text-3xl font-bold text-green-600">{overviewStats.tasksCompleted}</p>
                    </div>
                    <div className="text-4xl">✅</div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
                  <h3 className="text-lg font-semibold mb-4">Task Status Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-neutral-300">Completed</span>
                      <span className="font-semibold text-green-600">{overviewStats.tasksCompleted}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-neutral-300">In Progress</span>
                      <span className="font-semibold text-blue-600">{overviewStats.tasksInProgress}</span>
                    </div>
                    {overviewStats.avgTaskCompletion > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-gray-600 dark:text-neutral-300">Avg Completion Time</span>
                        <span className="font-semibold">{overviewStats.avgTaskCompletion.toFixed(1)} hrs</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
                  <h3 className="text-lg font-semibold mb-4">Payroll Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-neutral-300">Total Hours</span>
                      <span className="font-semibold">{overviewStats.totalHours.toFixed(1)} hrs</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-neutral-300">Total Pay</span>
                      <span className="font-semibold text-red-600">${overviewStats.totalPay.toFixed(2)}</span>
                    </div>
                    {overviewStats.totalHours > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-gray-600 dark:text-neutral-300">Avg Hourly Cost</span>
                        <span className="font-semibold text-amber-600">${(overviewStats.totalPay / overviewStats.totalHours).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Time & Payroll Tab */}
          {activeTab === 'time' && timeReport && (
            <TimePayrollReport data={timeReport} onExport={() => exportToCSV(timeReport.report, 'timesheet')} />
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && taskReport && (
            <TaskReport data={taskReport} onExport={() => exportToCSV(taskReport.tasks, 'tasks')} />
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && employeePerformance && (
            <PerformanceReport data={employeePerformance} />
          )}
        </>
      )}
    </div>
  );
};

// Time & Payroll Report Component
const TimePayrollReport = ({ data, onExport }) => {
  const groupedByUser = data?.report?.reduce((acc, entry) => {
    if (!acc[entry.user_id]) {
      acc[entry.user_id] = {
        user_name: entry.user_name,
        entries: [],
        totalHours: 0,
        totalPay: 0
      };
    }
    acc[entry.user_id].entries.push(entry);
    acc[entry.user_id].totalHours += parseFloat(entry.hours || 0);
    acc[entry.user_id].totalPay += parseFloat(entry.pay || 0);
    return acc;
  }, {}) || {};

  const grandTotalHours = Object.values(groupedByUser).reduce((sum, g) => sum + g.totalHours, 0);
  const grandTotalPay = Object.values(groupedByUser).reduce((sum, g) => sum + g.totalPay, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Time & Payroll Report</h3>
          <p className="text-sm text-gray-600 dark:text-neutral-300">Week Ending: {formatDate(data.week_ending_date)}</p>
        </div>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Total Hours</p>
          <p className="text-2xl font-bold text-blue-700">{grandTotalHours.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <p className="text-sm text-red-600">Total Payroll</p>
          <p className="text-2xl font-bold text-red-700">${grandTotalPay.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600">Employees</p>
          <p className="text-2xl font-bold text-purple-700">{Object.keys(groupedByUser).length}</p>
        </div>
      </div>

      {Object.values(groupedByUser).map((group) => (
        <div key={group.user_name} className="bg-white dark:bg-neutral-900 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">{group.user_name}</h3>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-neutral-300">Total: {group.totalHours.toFixed(2)} hrs</p>
              {group.totalPay > 0 && (
                <p className="text-lg font-bold text-red-600">${group.totalPay.toFixed(2)}</p>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr>
                  <th className="text-left py-2 px-4">Date</th>
                  <th className="text-left py-2 px-4">Clock In</th>
                  <th className="text-left py-2 px-4">Clock Out</th>
                  <th className="text-left py-2 px-4">Break</th>
                  <th className="text-left py-2 px-4">Hours</th>
                  <th className="text-left py-2 px-4">Rate</th>
                  <th className="text-left py-2 px-4">Pay</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="py-2 px-4">{formatDate(entry.clock_in)}</td>
                    <td className="py-2 px-4">{formatTime(entry.clock_in)}</td>
                    <td className="py-2 px-4">{entry.clock_out ? formatTime(entry.clock_out) : '—'}</td>
                    <td className="py-2 px-4">{entry.break_minutes || 0} min</td>
                    <td className="py-2 px-4 font-semibold">{entry.hours || '0.00'}</td>
                    <td className="py-2 px-4 text-amber-600">${entry.effective_hourly_rate || entry.hourly_rate || 0}</td>
                    <td className="py-2 px-4 font-semibold text-red-600">${entry.pay || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

// Task Report Component
const TaskReport = ({ data, onExport }) => {
  const tasks = data?.tasks || [];
  const byStatus = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  const byCategory = tasks.reduce((acc, task) => {
    acc[task.category] = (acc[task.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Task Report</h3>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-4">
          <p className="text-sm text-gray-600 dark:text-neutral-300">Total Tasks</p>
          <p className="text-2xl font-bold">{tasks.length}</p>
        </div>
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-4">
            <p className="text-sm text-gray-600 dark:text-neutral-300 capitalize">{status.replace('_', ' ')}</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Title</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Assigned To</th>
                <th className="text-left py-3 px-4">Priority</th>
                <th className="text-left py-3 px-4">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                  <td className="py-3 px-4 font-medium">{task.title}</td>
                  <td className="py-3 px-4">{task.category}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      task.status === 'completed' ? 'bg-green-100 text-green-800' :
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-neutral-200'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">{task.assigned_to_name || 'Unassigned'}</td>
                  <td className="py-3 px-4 capitalize">{task.priority}</td>
                  <td className="py-3 px-4">{task.due_date ? formatDate(task.due_date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Performance Report Component
const PerformanceReport = ({ data }) => {
  const employees = data?.employees || [];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Employee Performance Report</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp) => {
          // Map backend fields to frontend expectations
          const avgCompletionHours = emp.avg_task_duration_hours || emp.avg_completion_hours;
          const totalHours = emp.total_hours_worked || emp.total_hours || emp.total_task_hours;
          const tasksCompleted = emp.tasks_completed || 0;
          const tasksWithTiming = emp.tasks_with_timing || 0;
          
          return (
            <div key={emp.id} className="bg-white dark:bg-neutral-900 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
              <h4 className="text-lg font-semibold mb-4">{emp.full_name}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-neutral-300">Tasks Completed:</span>
                  <span className="font-semibold">{tasksCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-neutral-300">Avg Completion Time:</span>
                  <span className="font-semibold">
                    {avgCompletionHours ? avgCompletionHours.toFixed(1) + ' hrs' : 
                     tasksWithTiming > 0 ? 'Calculating...' : 'No timing data'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-neutral-300">Total Hours Worked:</span>
                  <span className="font-semibold">{totalHours ? parseFloat(totalHours).toFixed(1) : '0'}</span>
                </div>
                {emp.tasks_per_hour && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600 dark:text-neutral-300">Tasks/Hour:</span>
                    <span className="font-semibold text-blue-600">{emp.tasks_per_hour}</span>
                  </div>
                )}
                {emp.completion_rate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-neutral-300">Completion Rate:</span>
                    <span className="font-semibold text-green-600">{emp.completion_rate}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Reports;

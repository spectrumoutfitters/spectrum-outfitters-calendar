import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';

const Analytics = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedUser, setSelectedUser] = useState('');
  const [userList, setUserList] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'performance') {
      loadPerformance();
    } else if (activeTab === 'categories') {
      loadCategories();
    } else if (activeTab === 'trends') {
      loadTrends();
    }
  }, [activeTab, startDate, endDate, selectedUser]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUserList(response.data.users.filter(u => u.is_active));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      if (selectedUser) params.user_id = selectedUser;
      
      const [perfRes, catRes, weeklyRes] = await Promise.all([
        api.get('/analytics/employee-performance', { params }).catch(() => null),
        api.get('/analytics/category-breakdown', { params }).catch(() => null),
        api.get('/analytics/weekly-comparison', { params: { weeks: 4 } }).catch(() => null)
      ]);

      setDashboardData({
        performance: perfRes?.data || null,
        categories: catRes?.data || null,
        weekly: weeklyRes?.data || null
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformance = async () => {
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      if (selectedUser) params.user_id = selectedUser;
      const response = await api.get('/analytics/employee-performance', { params });
      setPerformanceData(response.data);
    } catch (error) {
      console.error('Error loading performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      const response = await api.get('/analytics/category-breakdown', { params });
      setCategoryData(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async () => {
    setLoading(true);
    try {
      const params = { weeks: 8 };
      if (selectedUser) params.user_id = selectedUser;
      const response = await api.get('/analytics/weekly-comparison', { params });
      setWeeklyData(response.data);
    } catch (error) {
      console.error('Error loading trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateKPIs = () => {
    if (!dashboardData?.performance) return null;

    const employees = dashboardData.performance.employees || [];
    const totalHours = employees.reduce((sum, e) => sum + parseFloat(e.total_hours_worked || 0), 0);
    const totalTasks = employees.reduce((sum, e) => sum + (e.tasks_completed || 0), 0);
    const avgTasksPerHour = totalHours > 0 ? (totalTasks / totalHours).toFixed(2) : '0.00';
    const avgCompletionRate = employees.length > 0
      ? (employees.reduce((sum, e) => sum + parseFloat(e.completion_rate || 0), 0) / employees.length).toFixed(1)
      : '0.0';
    const totalCost = employees.reduce((sum, e) => {
      const hourlyRate = e.hourly_rate || (e.weekly_salary ? e.weekly_salary / 40 : 0);
      return sum + (parseFloat(e.total_hours_worked || 0) * hourlyRate);
    }, 0);

    return {
      totalHours,
      totalTasks,
      avgTasksPerHour,
      avgCompletionRate,
      totalCost,
      activeEmployees: employees.length
    };
  };

  const kpis = calculateKPIs();

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'performance', label: '👥 Performance', icon: '👥' },
    { id: 'categories', label: '📁 Categories', icon: '📁' },
    { id: 'trends', label: '📈 Trends', icon: '📈' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Business Analytics & Insights</h1>
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <span className="self-center text-gray-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Employees</option>
            {userList.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          <p className="mt-2 text-gray-600">Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && dashboardData && (
            <DashboardView data={dashboardData} kpis={kpis} />
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && performanceData && (
            <PerformanceView data={performanceData} />
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && categoryData && (
            <CategoriesView data={categoryData} />
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && weeklyData && (
            <TrendsView data={weeklyData} />
          )}
        </>
      )}
    </div>
  );
};

// Dashboard View Component
const DashboardView = ({ data, kpis }) => {
  if (!kpis) {
    return <div className="text-center py-8 text-gray-500">No data available</div>;
  }

  const employees = data?.performance?.employees || [];
  const categories = data?.categories?.categories || [];
  const topPerformers = [...employees]
    .sort((a, b) => parseFloat(b.tasks_per_hour || 0) - parseFloat(a.tasks_per_hour || 0))
    .slice(0, 3);
  
  const slowestCategories = [...categories]
    .filter(c => c.avg_duration_hours)
    .sort((a, b) => parseFloat(b.avg_duration_hours) - parseFloat(a.avg_duration_hours))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Hours Worked</p>
              <p className="text-3xl font-bold mt-1">{kpis.totalHours.toFixed(1)}</p>
            </div>
            <div className="text-4xl opacity-80">⏰</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Tasks Completed</p>
              <p className="text-3xl font-bold mt-1">{kpis.totalTasks}</p>
            </div>
            <div className="text-4xl opacity-80">✅</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Avg Tasks/Hour</p>
              <p className="text-3xl font-bold mt-1">{kpis.avgTasksPerHour}</p>
            </div>
            <div className="text-4xl opacity-80">⚡</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Labor Cost</p>
              <p className="text-3xl font-bold mt-1">${kpis.totalCost.toFixed(0)}</p>
            </div>
            <div className="text-4xl opacity-80">💰</div>
          </div>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-yellow-500">🏆</span> Top Performers
          </h3>
          <div className="space-y-3">
            {topPerformers.map((emp, idx) => (
              <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                    idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-orange-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium">{emp.full_name}</p>
                    <p className="text-sm text-gray-600">{emp.tasks_completed} tasks completed</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">{emp.tasks_per_hour} tasks/hr</p>
                  <p className="text-xs text-gray-500">{emp.completion_rate}% completion</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Insights */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-blue-500">📊</span> Category Performance
          </h3>
          <div className="space-y-3">
            {categories.slice(0, 5).map((cat) => (
              <div key={cat.category} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{cat.category}</span>
                  <span className="text-sm text-gray-600">{cat.completion_rate}% complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${cat.completion_rate}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{cat.completed_tasks}/{cat.total_tasks} tasks</span>
                  {cat.avg_duration_hours && (
                    <span>Avg: {parseFloat(cat.avg_duration_hours).toFixed(1)}h</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Efficiency Insights */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-green-500">💡</span> Key Insights
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-900">Average Completion Rate</p>
              <p className="text-2xl font-bold text-green-700">{kpis.avgCompletionRate}%</p>
              <p className="text-sm text-green-700 mt-1">
                {parseFloat(kpis.avgCompletionRate) >= 80 
                  ? '✅ Excellent performance!' 
                  : parseFloat(kpis.avgCompletionRate) >= 60
                  ? '⚠️ Room for improvement'
                  : '❌ Needs attention'}
              </p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-medium text-blue-900">Productivity Rate</p>
              <p className="text-2xl font-bold text-blue-700">{kpis.avgTasksPerHour} tasks/hour</p>
              <p className="text-sm text-blue-700 mt-1">
                {parseFloat(kpis.avgTasksPerHour) >= 2 
                  ? '🚀 High productivity!' 
                  : parseFloat(kpis.avgTasksPerHour) >= 1
                  ? '📈 Good pace'
                  : '🐌 Below average'}
              </p>
            </div>
            {slowestCategories.length > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="font-medium text-orange-900">Slowest Categories</p>
                <ul className="text-sm text-orange-800 mt-2 space-y-1">
                  {slowestCategories.map((cat) => (
                    <li key={cat.category}>
                      • {cat.category}: {parseFloat(cat.avg_duration_hours).toFixed(1)}h avg
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Employee Summary */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-purple-500">👥</span> Team Overview
          </h3>
          <div className="space-y-2">
            {employees.slice(0, 5).map((emp) => (
              <div key={emp.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{emp.full_name}</p>
                  <p className="text-xs text-gray-500">{parseFloat(emp.total_hours_worked || 0).toFixed(1)}h worked</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{emp.tasks_completed} tasks</p>
                  <p className="text-xs text-gray-500">{emp.completion_rate}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Performance View Component
const PerformanceView = ({ data }) => {
  const employees = data?.employees || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold">Employee Performance Metrics</h3>
          <p className="text-sm text-gray-600">Detailed performance breakdown by employee</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Employee</th>
                <th className="text-right py-3 px-4">Tasks</th>
                <th className="text-right py-3 px-4">Completed</th>
                <th className="text-right py-3 px-4">Hours</th>
                <th className="text-right py-3 px-4">Tasks/Hr</th>
                <th className="text-right py-3 px-4">Completion</th>
                <th className="text-right py-3 px-4">Avg Duration</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{emp.full_name}</td>
                  <td className="py-3 px-4 text-right">{emp.total_tasks_assigned}</td>
                  <td className="py-3 px-4 text-right text-green-600 font-semibold">{emp.tasks_completed}</td>
                  <td className="py-3 px-4 text-right">{parseFloat(emp.total_hours_worked || 0).toFixed(1)}h</td>
                  <td className="py-3 px-4 text-right font-semibold text-blue-600">{emp.tasks_per_hour}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      parseFloat(emp.completion_rate) >= 80 ? 'bg-green-100 text-green-800' :
                      parseFloat(emp.completion_rate) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {emp.completion_rate}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {emp.avg_task_duration_hours 
                      ? `${parseFloat(emp.avg_task_duration_hours).toFixed(2)}h`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Categories View Component
const CategoriesView = ({ data }) => {
  const categories = data?.categories || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.category} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">{cat.category}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Tasks:</span>
                <span className="font-semibold">{cat.total_tasks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed:</span>
                <span className="font-semibold text-green-600">{cat.completed_tasks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">In Progress:</span>
                <span className="font-semibold text-blue-600">{cat.in_progress_tasks}</span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Completion Rate</span>
                  <span className="text-sm font-semibold">{cat.completion_rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${cat.completion_rate}%` }}
                  ></div>
                </div>
              </div>
              {cat.avg_duration_hours && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Duration:</span>
                    <span className="font-semibold">{parseFloat(cat.avg_duration_hours).toFixed(1)}h</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Trends View Component
const TrendsView = ({ data }) => {
  const weeks = data?.weeks || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">8-Week Performance Trends</h3>
        <div className="space-y-4">
          {weeks.map((week, idx) => (
            <div key={idx} className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">{week.week_label}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {week.employees.map((emp) => (
                  <div key={emp.id} className="bg-gray-50 rounded p-3">
                    <p className="font-medium">{emp.full_name}</p>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-600">{emp.tasks_completed} tasks</span>
                      <span className="text-gray-600">{parseFloat(emp.hours_worked || 0).toFixed(1)}h</span>
                      <span className="font-semibold text-blue-600">{emp.tasks_per_hour}/hr</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;

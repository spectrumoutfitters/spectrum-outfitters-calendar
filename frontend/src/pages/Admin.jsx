import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import UserManagement from '../components/Admin/UserManagement';
import TimeApproval from '../components/Admin/TimeApproval';
import Reports from '../components/Admin/Reports';
import EmployeeStatus from '../components/Admin/EmployeeStatus';
import ScheduleCalendar from '../components/Admin/ScheduleCalendar';
import Analytics from '../components/Admin/Analytics';
import ProductManagement from '../components/Admin/ProductManagement';
import InventoryManagement from '../components/Admin/InventoryManagement';
import OrderManagement from '../components/Admin/OrderManagement';
import PayrollManagement from '../components/Admin/PayrollManagement';
import Settings from '../components/Admin/Settings';
import AdminWorkList from '../components/Admin/AdminWorkList';
import ComplianceCenter from '../components/Admin/ComplianceCenter';
import FinanceDashboard from '../components/Admin/FinanceDashboard';
import SystemUpdates from '../components/Admin/SystemUpdates';
import SecuritySessions from '../components/Admin/SecuritySessions';
const Admin = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'dashboard');
  const [dashboardData, setDashboardData] = useState({
    worklistItems: [],
    pendingTimeOff: 0,
    unapprovedTimeEntries: 0,
    tasksInReview: 0,
    clockedInEmployees: 0,
    totalEmployees: 0,
    upcomingCompliance: [],
    overdueCompliance: [],
    recentOrders: 0,
    lowStockProducts: 0,
    pendingReorderRequests: 0
  });
  const [loading, setLoading] = useState(true);

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Load dashboard data
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [activeTab]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [worklistRes, statusRes, complianceRes, reorderCountRes] = await Promise.all([
        api.get('/admin/worklist/today').catch(() => ({ data: { items: [] } })),
        api.get('/time/employees/status').catch(() => ({ data: [] })),
        api.get('/compliance/dashboard').catch(() => ({ data: { upcoming: [], overdue: [] } })),
        api.get('/inventory/refill-requests/count', { params: { status: 'pending' } }).catch(() => ({ data: { count: 0 } }))
      ]);

      const worklist = worklistRes.data?.allItems || worklistRes.data?.items || [];
      const employees = statusRes.data || [];
      const compliance = complianceRes.data || {};
      const pendingReorderRequests = reorderCountRes.data?.count ?? 0;

      // Count pending items from worklist
      const pendingItems = worklist.filter(item => !item.is_completed);
      const pendingTimeOff = pendingItems.filter(i => i.smart_key === 'pending_time_off').length > 0
        ? parseInt(pendingItems.find(i => i.smart_key === 'pending_time_off')?.title?.match(/\d+/)?.[0] || 0)
        : 0;
      const unapprovedTime = pendingItems.filter(i => i.smart_key === 'unapproved_time').length > 0
        ? parseInt(pendingItems.find(i => i.smart_key === 'unapproved_time')?.title?.match(/\d+/)?.[0] || 0)
        : 0;
      const tasksReview = pendingItems.filter(i => i.smart_key === 'tasks_in_review').length > 0
        ? parseInt(pendingItems.find(i => i.smart_key === 'tasks_in_review')?.title?.match(/\d+/)?.[0] || 0)
        : 0;

      setDashboardData({
        worklistItems: worklist,
        worklistCompleted: worklist.filter(i => i.is_completed).length,
        worklistTotal: worklist.length,
        pendingTimeOff,
        unapprovedTimeEntries: unapprovedTime,
        tasksInReview: tasksReview,
        clockedInEmployees: employees.filter(e => e.status === 'clocked_in' || e.status === 'on_lunch').length,
        totalEmployees: employees.length,
        upcomingCompliance: compliance.upcoming || [],
        overdueCompliance: compliance.overdue || [],
        pendingReorderRequests
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const categoryOrder = ['people', 'shop', 'finance', 'insights', 'system'];
  const categoryLabels = {
    people: { label: 'People & Team', icon: '👥', description: 'Staff, schedules, and time off' },
    shop: { label: 'Shop & Orders', icon: '🛒', description: 'Inventory, products, and customer orders' },
    finance: { label: 'Finance & Compliance', icon: '💰', description: 'Payroll, tax, and filings' },
    insights: { label: 'Insights & Reports', icon: '📊', description: 'Analytics and business reports' },
    system: { label: 'System', icon: '🔧', description: 'Settings and updates' }
  };

  const modules = [
    {
      id: 'worklist',
      category: 'people',
      label: 'Daily Work List',
      icon: '📋',
      color: 'bg-primary',
      description: 'Your daily admin tasks and checklist',
      getBadge: () => {
        const pending = dashboardData.worklistTotal - dashboardData.worklistCompleted;
        return pending > 0 ? { count: pending, color: 'bg-orange-500' } : { count: '✓', color: 'bg-green-500' };
      }
    },
    {
      id: 'status',
      category: 'people',
      label: 'Employee Status',
      icon: '👥',
      color: 'bg-green-500',
      description: 'Who\'s clocked in, on lunch, or off',
      getBadge: () => ({ count: `${dashboardData.clockedInEmployees}/${dashboardData.totalEmployees}`, color: 'bg-green-600' })
    },
    {
      id: 'time',
      category: 'people',
      label: 'Time Off Requests',
      icon: '🏖️',
      color: 'bg-primary-light',
      description: 'Review and approve time off',
      getBadge: () => dashboardData.pendingTimeOff > 0 ? { count: dashboardData.pendingTimeOff, color: 'bg-red-500' } : null
    },
    {
      id: 'users',
      category: 'people',
      label: 'User Management',
      icon: '⚙️',
      color: 'bg-gray-500',
      description: 'Employee accounts and permissions'
    },
    {
      id: 'schedule',
      category: 'people',
      label: 'Schedule',
      icon: '📅',
      color: 'bg-primary',
      description: 'View and manage schedules'
    },
    {
      id: 'inventory',
      category: 'shop',
      label: 'Inventory',
      icon: '📦',
      color: 'bg-sky-500',
      description: 'Shop supplies (barcodes, quantities, prices)',
      getBadge: () => dashboardData.pendingReorderRequests > 0 ? { count: dashboardData.pendingReorderRequests, color: 'bg-amber-500', label: 'Reorder' } : null
    },
    {
      id: 'products',
      category: 'shop',
      label: 'Products',
      icon: '🛒',
      color: 'bg-teal-500',
      description: 'Product catalog for orders'
    },
    {
      id: 'orders',
      category: 'shop',
      label: 'Orders',
      icon: '📦',
      color: 'bg-amber-500',
      description: 'Track and manage customer orders'
    },
    {
      id: 'payroll',
      category: 'finance',
      label: 'Payroll',
      icon: '💰',
      color: 'bg-emerald-500',
      description: 'Process payroll and compensation'
    },
    {
      id: 'finance',
      category: 'finance',
      label: 'Financial Planner',
      icon: '📈',
      color: 'bg-indigo-500',
      description: 'Bank connections, revenue sync, cash flow & forecasting'
    },
    {
      id: 'compliance',
      category: 'finance',
      label: 'Tax & Compliance',
      icon: '🏛️',
      color: 'bg-red-500',
      description: 'Sales tax, payroll tax, and filings',
      getBadge: () => dashboardData.overdueCompliance?.length > 0 
        ? { count: dashboardData.overdueCompliance.length, color: 'bg-red-600', label: 'OVERDUE' } 
        : dashboardData.upcomingCompliance?.length > 0 
          ? { count: dashboardData.upcomingCompliance.length, color: 'bg-yellow-500' }
          : null
    },
    {
      id: 'analytics',
      category: 'insights',
      label: 'Analytics',
      icon: '📈',
      color: 'bg-cyan-500',
      description: 'Business insights and metrics'
    },
    {
      id: 'reports',
      category: 'insights',
      label: 'Reports',
      icon: '📊',
      color: 'bg-violet-500',
      description: 'Generate detailed reports'
    },
    {
      id: 'settings',
      category: 'system',
      label: 'Settings',
      icon: '🔧',
      color: 'bg-slate-500',
      description: 'Configuration and preferences'
    },
    {
      id: 'updates',
      category: 'system',
      label: 'System Updates',
      icon: '📢',
      color: 'bg-pink-500',
      description: 'Update notifications and changelog'
    },
    {
      id: 'security',
      category: 'system',
      label: 'Security & Sessions',
      icon: '🔒',
      color: 'bg-red-600',
      description: 'Login audit, active sessions, on-prem verification'
    }
  ];

  // Render dashboard view
  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600">Loading dashboard...</span>
        </div>
      );
    }

    const urgentItems = [];
    
    // Check for overdue compliance
    if (dashboardData.overdueCompliance?.length > 0) {
      urgentItems.push({
        type: 'error',
        icon: '🚨',
        message: `${dashboardData.overdueCompliance.length} overdue tax obligation(s)!`,
        action: () => navigateToTab('compliance')
      });
    }

    // Check for pending time off
    if (dashboardData.pendingTimeOff > 0) {
      urgentItems.push({
        type: 'warning',
        icon: '🏖️',
        message: `${dashboardData.pendingTimeOff} time off request(s) pending approval`,
        action: () => navigateToTab('time')
      });
    }

    // Check for unapproved time entries
    if (dashboardData.unapprovedTimeEntries > 0) {
      urgentItems.push({
        type: 'warning',
        icon: '⏰',
        message: `${dashboardData.unapprovedTimeEntries} time entries need approval`,
        action: () => navigateToTab('time')
      });
    }

    // Check for tasks in review
    if (dashboardData.tasksInReview > 0) {
      urgentItems.push({
        type: 'info',
        icon: '✅',
        message: `${dashboardData.tasksInReview} task(s) waiting for review`,
        action: () => navigate('/tasks?status=review')
      });
    }

    // Reorder requests from the shop (tell office to order)
    if (dashboardData.pendingReorderRequests > 0) {
      urgentItems.push({
        type: 'warning',
        icon: '📦',
        message: `${dashboardData.pendingReorderRequests} reorder request(s) — fill out where ordered, price & when it will arrive`,
        action: () => { setSearchParams({ tab: 'inventory', refills: '1' }); setActiveTab('inventory'); }
      });
    }

    const allClear = urgentItems.length === 0 && dashboardData.worklistCompleted === dashboardData.worklistTotal;

    return (
      <div className="space-y-6">
        {/* Status + Today's Progress in one block */}
        <div className="space-y-3">
          {allClear ? (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <h2 className="text-lg font-bold">All Caught Up!</h2>
                    <p className="text-sm opacity-90">No urgent items. Great job staying on top of things!</p>
                  </div>
                </div>
                <button
                  onClick={() => navigateToTab('worklist')}
                  className="flex items-center gap-3 bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 text-left text-sm font-medium transition shrink-0"
                >
                  <span className="text-gray-200">Today: {dashboardData.worklistCompleted}/{dashboardData.worklistTotal} tasks</span>
                  <span>View list →</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-3xl">⚡</span>
                <div>
                  <h2 className="text-lg font-bold">Needs Your Attention</h2>
                  <p className="text-sm opacity-90">{urgentItems.length} item(s) require action</p>
                </div>
              </div>
              <div className="space-y-2">
                {urgentItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={item.action}
                    className="w-full text-left bg-white/20 hover:bg-white/30 rounded-lg p-3 flex items-center gap-3 transition text-sm"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.message}</span>
                    <span className="ml-auto">→</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
                <span className="text-sm opacity-90">Today: {dashboardData.worklistCompleted}/{dashboardData.worklistTotal} work list tasks</span>
                <button onClick={() => navigateToTab('worklist')} className="text-sm font-medium underline hover:no-underline">View list →</button>
              </div>
            </div>
          )}
        </div>

        {/* Today's daily tasks — always visible so admins are reminded */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">📋 Today&apos;s tasks</h3>
            <button
              onClick={() => navigateToTab('worklist')}
              className="text-primary hover:text-primary/80 text-sm font-medium"
            >
              View full list →
            </button>
          </div>
          {loading ? (
            <p className="text-gray-500 text-sm py-2">Loading…</p>
          ) : !dashboardData.worklistItems?.length ? (
            <p className="text-gray-500 text-sm py-2">No tasks for today. Add some on the work list.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {dashboardData.worklistItems
                .filter((i) => !i.is_completed)
                .slice(0, 10)
                .map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
                    <span className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300" aria-hidden />
                    <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{item.title}</span>
                    {item.link_target && (
                      <button
                        type="button"
                        onClick={() => navigate(item.link_target)}
                        className="text-xs text-primary shrink-0 hover:underline"
                      >
                        Open
                      </button>
                    )}
                  </li>
                ))}
              {dashboardData.worklistItems.filter((i) => i.is_completed).length > 0 && (
                <li className="pt-2 mt-2 border-t border-gray-100 text-xs text-gray-500">
                  ✓ {dashboardData.worklistItems.filter((i) => i.is_completed).length} completed
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Upcoming Compliance — only when there's data */}
        {dashboardData.upcomingCompliance?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800">🏛️ Upcoming Tax Deadlines</h3>
              <button
                onClick={() => navigateToTab('compliance')}
                className="text-primary hover:text-primary-dark text-sm font-medium"
              >
                View All →
              </button>
            </div>
            <div className="space-y-2">
              {dashboardData.upcomingCompliance.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{item.obligation_name}</p>
                    <p className="text-xs text-gray-500">Due: {new Date(item.due_date).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.days_until_due <= 7 ? 'bg-orange-100 text-orange-700' : 'bg-primary-subtle text-primary'
                  }`}>
                    {item.days_until_due} days
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modules by category */}
        <div className="space-y-6">
          {categoryOrder.map((catId) => {
            const cat = categoryLabels[catId];
            const catModules = modules.filter((m) => m.category === catId);
            if (catModules.length === 0) return null;
            return (
              <div key={catId}>
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <span>{cat.icon}</span>
                    {cat.label}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {catModules.map((module) => {
                    const badge = module.getBadge?.();
                    return (
                      <button
                        key={module.id}
                        onClick={() => navigateToTab(module.id)}
                        className="relative bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all text-left group"
                      >
                        {badge && (
                          <span className={`absolute -top-1.5 -right-1.5 ${badge.color} text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center`}>
                            {badge.count}
                          </span>
                        )}
                        <div className={`w-10 h-10 ${module.color} rounded-lg flex items-center justify-center text-xl mb-2 group-hover:scale-105 transition-transform`}>
                          {module.icon}
                        </div>
                        <h4 className="font-semibold text-gray-800 text-sm">{module.label}</h4>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{module.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // If not on dashboard, show module with back button
  if (activeTab !== 'dashboard') {
    const currentModule = modules.find(m => m.id === activeTab);
    
    return (
      <div className="space-y-4">
        {/* Breadcrumb header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigateToTab('dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-700"
          >
            <span>←</span>
            <span>Dashboard</span>
          </button>
          <span className="text-gray-400">/</span>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>{currentModule?.icon}</span>
            {currentModule?.label || 'Admin'}
          </h1>
        </div>

        {/* Module content */}
        <div>
          {activeTab === 'worklist' && <AdminWorkList />}
          {activeTab === 'status' && <EmployeeStatus />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'time' && <TimeApproval />}
          {activeTab === 'schedule' && <ScheduleCalendar />}
          {activeTab === 'inventory' && <InventoryManagement />}
          {activeTab === 'products' && <ProductManagement />}
          {activeTab === 'orders' && <OrderManagement />}
          {activeTab === 'payroll' && <PayrollManagement />}
          {activeTab === 'finance' && <FinanceDashboard />}
          {activeTab === 'compliance' && <ComplianceCenter />}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'reports' && <Reports />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'updates' && <SystemUpdates />}
          {activeTab === 'security' && <SecuritySessions />}
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {renderDashboard()}
    </div>
  );
};

export default Admin;

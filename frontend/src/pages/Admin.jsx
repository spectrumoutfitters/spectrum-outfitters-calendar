import React, { useState, useEffect, useRef } from 'react';
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
import AdminHistory from '../components/Admin/AdminHistory';
import AdminBroadcastNotification from '../components/Notifications/AdminBroadcastNotification';

// Map legacy tab IDs to new main+sub structure
const LEGACY_MAP = {
  dashboard:  { main: 'overview', sub: null },
  worklist:   { main: 'overview', sub: null },
  status:     { main: 'team',     sub: 'status' },
  time:       { main: 'team',     sub: 'time' },
  users:      { main: 'team',     sub: 'users' },
  schedule:   { main: 'team',     sub: 'schedule' },
  history:    { main: 'team',     sub: 'history' },
  inventory:  { main: 'shop',     sub: 'inventory' },
  orders:     { main: 'shop',     sub: 'orders' },
  products:   { main: 'shop',     sub: 'products' },
  payroll:    { main: 'finance',  sub: 'payroll' },
  finance:    { main: 'finance',  sub: 'finance' },
  compliance: { main: 'finance',  sub: 'compliance' },
  analytics:  { main: 'insights', sub: 'analytics' },
  reports:    { main: 'insights', sub: 'reports' },
  settings:   { main: 'settings', sub: 'general' },
  updates:    { main: 'settings', sub: 'updates' },
  security:   { main: 'settings', sub: 'security' },
};

const DEFAULT_SUB = {
  team:     'status',
  shop:     'inventory',
  finance:  'payroll',
  insights: 'analytics',
  settings: 'general',
};

const MAIN_TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'team',      label: 'Team' },
  { id: 'shop',      label: 'Shop' },
  { id: 'finance',   label: 'Finance' },
  { id: 'insights',  label: 'Insights' },
  { id: 'settings',  label: 'Settings' },
];

const SUB_TABS = {
  team:     ['status', 'schedule', 'time', 'users', 'history'],
  shop:     ['inventory', 'orders', 'products'],
  finance:  ['payroll', 'finance', 'compliance'],
  insights: ['analytics', 'reports'],
  settings: ['general', 'security', 'updates'],
};

const SUB_TAB_LABELS = {
  status:     'Status',
  schedule:   'Schedule',
  time:       'Time',
  users:      'Users',
  history:    'History',
  inventory:  'Inventory',
  orders:     'Orders',
  products:   'Products',
  payroll:    'Payroll',
  finance:    'Finance',
  compliance: 'Compliance',
  analytics:  'Analytics',
  reports:    'Reports',
  general:    'General',
  security:   'Security',
  updates:    'Updates',
};

const LS_KEY = 'admin-active-tab';

function resolveInitialTab(tabFromUrl) {
  if (tabFromUrl) {
    if (LEGACY_MAP[tabFromUrl]) return LEGACY_MAP[tabFromUrl];
    if (MAIN_TABS.find(t => t.id === tabFromUrl)) return { main: tabFromUrl, sub: DEFAULT_SUB[tabFromUrl] || null };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved?.main && MAIN_TABS.find(t => t.id === saved.main)) return saved;
  } catch {}
  return { main: 'overview', sub: null };
}

const Admin = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');

  const initial = resolveInitialTab(tabFromUrl);
  const [activeMain, setActiveMain] = useState(initial.main);
  const [activeSub, setActiveSub] = useState(initial.sub || DEFAULT_SUB[initial.main] || null);
  const [showBroadcast, setShowBroadcast] = useState(false);

  const [dashboardData, setDashboardData] = useState({
    worklistItems: [],
    worklistCompleted: 0,
    worklistTotal: 0,
    pendingTimeOff: 0,
    unapprovedTimeEntries: 0,
    tasksInReview: 0,
    clockedInEmployees: 0,
    totalEmployees: 0,
    upcomingCompliance: [],
    overdueCompliance: [],
    pendingReorderRequests: 0,
    lowStockItems: 0,
  });
  const [loading, setLoading] = useState(true);

  // Sync URL → state when URL changes externally
  useEffect(() => {
    if (!tabFromUrl) return;
    const resolved = resolveInitialTab(tabFromUrl);
    setActiveMain(resolved.main);
    setActiveSub(resolved.sub || DEFAULT_SUB[resolved.main] || null);
  }, [tabFromUrl]);

  // Persist to localStorage on every navigation
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ main: activeMain, sub: activeSub }));
    } catch {}
  }, [activeMain, activeSub]);

  // Load dashboard data on mount (and when returning to overview)
  useEffect(() => {
    if (activeMain === 'overview') loadDashboardData();
  }, [activeMain]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [worklistRes, statusRes, complianceRes, reorderCountRes, lowStockRes] = await Promise.all([
        api.get('/admin/worklist/today').catch(() => ({ data: { items: [] } })),
        api.get('/time/employees/status').catch(() => ({ data: [] })),
        api.get('/compliance/dashboard').catch(() => ({ data: { upcoming: [], overdue: [] } })),
        api.get('/inventory/refill-requests/count', { params: { status: 'pending' } }).catch(() => ({ data: { count: 0 } })),
        api.get('/inventory/items', { params: { low_stock: true, limit: 1 } }).catch(() => ({ data: { total: 0 } })),
      ]);

      const worklist = worklistRes.data?.allItems || worklistRes.data?.items || [];
      const employees = statusRes.data || [];
      const compliance = complianceRes.data || {};
      const pendingReorderRequests = reorderCountRes.data?.count ?? 0;
      const lowStockItems = lowStockRes.data?.total ?? lowStockRes.data?.count ?? 0;

      const pendingItems = worklist.filter(item => !item.is_completed);
      const pendingTimeOff = pendingItems.find(i => i.smart_key === 'pending_time_off')
        ? parseInt(pendingItems.find(i => i.smart_key === 'pending_time_off')?.title?.match(/\d+/)?.[0] || 0)
        : 0;
      const unapprovedTime = pendingItems.find(i => i.smart_key === 'unapproved_time')
        ? parseInt(pendingItems.find(i => i.smart_key === 'unapproved_time')?.title?.match(/\d+/)?.[0] || 0)
        : 0;
      const tasksReview = pendingItems.find(i => i.smart_key === 'tasks_in_review')
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
        pendingReorderRequests,
        lowStockItems,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToMain = (main) => {
    const sub = DEFAULT_SUB[main] || null;
    setActiveMain(main);
    setActiveSub(sub);
    setSearchParams({ tab: main });
  };

  const goToSub = (sub) => {
    setActiveSub(sub);
    setSearchParams({ tab: sub });
  };

  // Team badge = pending time approvals
  const teamBadge = dashboardData.unapprovedTimeEntries + dashboardData.pendingTimeOff;

  // ── Overview tab ────────────────────────────────────────────────────────────
  const renderOverview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-gray-600 dark:text-neutral-200">Loading…</span>
        </div>
      );
    }

    const urgentItems = [];
    if (dashboardData.overdueCompliance?.length > 0) {
      urgentItems.push({ icon: '🚨', message: `${dashboardData.overdueCompliance.length} overdue tax obligation(s)`, action: () => { setActiveMain('finance'); setActiveSub('compliance'); setSearchParams({ tab: 'compliance' }); } });
    }
    if (dashboardData.pendingTimeOff > 0) {
      urgentItems.push({ icon: '🏖️', message: `${dashboardData.pendingTimeOff} time off request(s) pending`, action: () => { setActiveMain('team'); setActiveSub('time'); setSearchParams({ tab: 'time' }); } });
    }
    if (dashboardData.unapprovedTimeEntries > 0) {
      urgentItems.push({ icon: '⏰', message: `${dashboardData.unapprovedTimeEntries} time entries need approval`, action: () => { setActiveMain('team'); setActiveSub('time'); setSearchParams({ tab: 'time' }); } });
    }
    if (dashboardData.tasksInReview > 0) {
      urgentItems.push({ icon: '✅', message: `${dashboardData.tasksInReview} task(s) awaiting review`, action: () => navigate('/tasks?status=review') });
    }
    if (dashboardData.pendingReorderRequests > 0) {
      urgentItems.push({ icon: '📦', message: `${dashboardData.pendingReorderRequests} reorder request(s) need attention`, action: () => { setActiveMain('shop'); setActiveSub('inventory'); setSearchParams({ tab: 'inventory' }); } });
    }

    return (
      <div className="space-y-6">
        {/* Alert banner */}
        {urgentItems.length > 0 ? (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-3xl">⚡</span>
              <div>
                <h2 className="text-lg font-bold">Needs Attention</h2>
                <p className="text-sm opacity-90">{urgentItems.length} item(s) require action</p>
              </div>
            </div>
            <div className="space-y-2">
              {urgentItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.action}
                  className="w-full text-left bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg p-3 flex items-center gap-3 transition text-sm"
                >
                  <span>{item.icon}</span>
                  <span className="flex-1">{item.message}</span>
                  <span>→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg flex items-center gap-4">
            <span className="text-3xl">🎉</span>
            <div>
              <h2 className="text-lg font-bold">All Caught Up!</h2>
              <p className="text-sm opacity-90">No urgent items. Great work!</p>
            </div>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => { setActiveMain('team'); setActiveSub('status'); setSearchParams({ tab: 'status' }); }}
            className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 text-left hover:shadow-md transition group"
          >
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-1">Staff In</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
              {dashboardData.clockedInEmployees}
              <span className="text-sm font-normal text-gray-400 ml-1">/ {dashboardData.totalEmployees}</span>
            </p>
            <p className="text-xs text-primary mt-1 group-hover:underline">View status →</p>
          </button>

          <button
            onClick={() => { setActiveMain('team'); setActiveSub('time'); setSearchParams({ tab: 'time' }); }}
            className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 text-left hover:shadow-md transition group"
          >
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-1">Pending Approvals</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
              {dashboardData.unapprovedTimeEntries + dashboardData.pendingTimeOff}
            </p>
            <p className="text-xs text-primary mt-1 group-hover:underline">Review →</p>
          </button>

          <button
            onClick={() => navigate('/tasks?status=review')}
            className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 text-left hover:shadow-md transition group"
          >
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-1">Open Tasks</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
              {dashboardData.tasksInReview}
            </p>
            <p className="text-xs text-primary mt-1 group-hover:underline">View tasks →</p>
          </button>

          <button
            onClick={() => { setActiveMain('shop'); setActiveSub('inventory'); setSearchParams({ tab: 'inventory' }); }}
            className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 text-left hover:shadow-md transition group"
          >
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-1">Low Stock</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
              {dashboardData.lowStockItems > 0 ? dashboardData.lowStockItems : dashboardData.pendingReorderRequests}
            </p>
            <p className="text-xs text-primary mt-1 group-hover:underline">Inventory →</p>
          </button>
        </div>

        {/* Today's work list */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100">📋 Today&apos;s Tasks</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              {dashboardData.worklistCompleted}/{dashboardData.worklistTotal} completed
            </p>
          </div>
          {!dashboardData.worklistItems?.length ? (
            <p className="text-sm text-gray-500 dark:text-neutral-400 py-2">No tasks for today.</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {dashboardData.worklistItems
                .filter(i => !i.is_completed)
                .slice(0, 10)
                .map(item => (
                  <li key={item.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <span className="flex-shrink-0 w-4 h-4 rounded border-2 border-gray-300 dark:border-neutral-600" />
                    <span className="text-sm text-gray-800 dark:text-neutral-100 flex-1 truncate">{item.title}</span>
                    {item.link_target && (
                      <button
                        onClick={() => navigate(item.link_target)}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Open
                      </button>
                    )}
                  </li>
                ))}
              {dashboardData.worklistItems.filter(i => i.is_completed).length > 0 && (
                <li className="pt-2 mt-1 border-t border-gray-100 dark:border-neutral-700 text-xs text-gray-500 dark:text-neutral-300">
                  ✓ {dashboardData.worklistItems.filter(i => i.is_completed).length} completed
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Employee Status', icon: '👥', main: 'team', sub: 'status' },
            { label: 'Time Approvals', icon: '⏰', main: 'team', sub: 'time' },
            { label: 'Inventory', icon: '📦', main: 'shop', sub: 'inventory' },
            { label: 'Payroll', icon: '💰', main: 'finance', sub: 'payroll' },
            { label: 'Analytics', icon: '📊', main: 'insights', sub: 'analytics' },
            { label: 'Settings', icon: '🔧', main: 'settings', sub: 'general' },
          ].map(link => (
            <button
              key={link.label}
              onClick={() => { setActiveMain(link.main); setActiveSub(link.sub); setSearchParams({ tab: link.sub }); }}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 flex items-center gap-3 hover:shadow-md hover:border-primary/40 transition text-left"
            >
              <span className="text-xl">{link.icon}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-neutral-200">{link.label}</span>
            </button>
          ))}
        </div>

        {/* Upcoming compliance */}
        {dashboardData.upcomingCompliance?.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100">🏛️ Upcoming Tax Deadlines</h3>
              <button
                onClick={() => { setActiveMain('finance'); setActiveSub('compliance'); setSearchParams({ tab: 'compliance' }); }}
                className="text-primary hover:text-primary-dark text-sm font-medium"
              >
                View All →
              </button>
            </div>
            <div className="space-y-2">
              {dashboardData.upcomingCompliance.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-neutral-100 text-sm">{item.obligation_name}</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">Due: {new Date(item.due_date).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.days_until_due <= 7
                      ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                      : 'bg-primary-subtle dark:bg-primary/20 text-primary'
                  }`}>
                    {item.days_until_due}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Sub-tab content renderer ─────────────────────────────────────────────────
  const renderSubContent = () => {
    switch (activeSub) {
      // Team
      case 'status':     return <EmployeeStatus />;
      case 'schedule':   return <ScheduleCalendar />;
      case 'time':       return <TimeApproval />;
      case 'users':      return <UserManagement />;
      case 'history':    return <AdminHistory />;
      // Shop
      case 'inventory':  return <InventoryManagement />;
      case 'orders':     return <OrderManagement />;
      case 'products':   return <ProductManagement />;
      // Finance
      case 'payroll':    return <PayrollManagement />;
      case 'finance':    return <FinanceDashboard />;
      case 'compliance': return <ComplianceCenter />;
      // Insights
      case 'analytics':  return <Analytics />;
      case 'reports':    return <Reports />;
      // Settings
      case 'general':    return <Settings />;
      case 'security':   return <SecuritySessions />;
      case 'updates':    return <SystemUpdates />;
      default:           return null;
    }
  };

  const GOLD = '#D4A017';

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-neutral-100">Admin</h1>
        <div className="flex items-center gap-2">
          <p className="hidden sm:block text-sm text-gray-500 dark:text-neutral-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <button
            onClick={() => setShowBroadcast(true)}
            title="Broadcast notification"
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
          >
            <span>📢</span>
            <span className="hidden sm:inline">Broadcast</span>
          </button>
        </div>
      </div>

      {/* Main tab bar */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 min-w-max border-b border-gray-200 dark:border-neutral-700">
          {MAIN_TABS.map((tab) => {
            const isActive = activeMain === tab.id;
            const badge = tab.id === 'team' && teamBadge > 0 ? teamBadge : null;
            return (
              <button
                key={tab.id}
                onClick={() => goToMain(tab.id)}
                className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-gray-900 dark:text-neutral-100'
                    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
                }`}
              >
                {tab.label}
                {badge && (
                  <span className="ml-1.5 inline-flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: GOLD }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab bar (when applicable) */}
      {activeMain !== 'overview' && SUB_TABS[activeMain] && (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-1 min-w-max">
            {SUB_TABS[activeMain].map((sub) => {
              const isActive = activeSub === sub;
              return (
                <button
                  key={sub}
                  onClick={() => goToSub(sub)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'text-white font-medium'
                      : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
                  }`}
                  style={isActive ? { backgroundColor: GOLD } : {}}
                >
                  {SUB_TAB_LABELS[sub]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab content */}
      <div>
        {activeMain === 'overview' ? renderOverview() : renderSubContent()}
      </div>

      {/* Broadcast modal */}
      {showBroadcast && (
        <AdminBroadcastNotification onClose={() => setShowBroadcast(false)} />
      )}
    </div>
  );
};

export default Admin;

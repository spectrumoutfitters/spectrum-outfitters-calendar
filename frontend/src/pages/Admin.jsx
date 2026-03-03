import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

const GOLD = '#D4A017';

// Tab definitions
const MAIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'Team' },
  { id: 'shop', label: 'Shop' },
  { id: 'finance', label: 'Finance' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' },
];

const SUB_TABS = {
  team: [
    { id: 'status', label: 'Status' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'time', label: 'Time' },
    { id: 'users', label: 'Users' },
    { id: 'worklist', label: 'Worklist' },
    { id: 'history', label: 'History' },
  ],
  shop: [
    { id: 'inventory', label: 'Inventory' },
    { id: 'orders', label: 'Orders' },
    { id: 'products', label: 'Products' },
  ],
  finance: [
    { id: 'payroll', label: 'Payroll' },
    { id: 'finance', label: 'Finance' },
    { id: 'compliance', label: 'Compliance' },
  ],
  insights: [
    { id: 'analytics', label: 'Analytics' },
    { id: 'reports', label: 'Reports' },
  ],
  settings: [
    { id: 'general', label: 'General' },
    { id: 'security', label: 'Security' },
    { id: 'updates', label: 'Updates' },
  ],
};

function TabBar({ tabs, activeId, onSelect, badge }) {
  return (
    <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-neutral-700 -mx-4 px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const hasBadge = badge && tab.id === badge.tabId && badge.count > 0;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`relative flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
            }`}
          >
            {tab.label}
            {hasBadge && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
                {badge.count}
              </span>
            )}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={{ backgroundColor: GOLD }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function SubTabBar({ tabs, activeId, onSelect }) {
  return (
    <div className="flex overflow-x-auto scrollbar-hide gap-1 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'text-white'
                : 'bg-gray-100 dark:bg-neutral-950 text-gray-600 dark:text-neutral-100 hover:bg-gray-200 dark:hover:bg-neutral-700'
            }`}
            style={isActive ? { backgroundColor: GOLD } : {}}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

const Admin = () => {
  const navigate = useNavigate();

  // Restore last tab from localStorage
  const savedMain = localStorage.getItem('admin_main_tab') || 'overview';
  const savedSubs = (() => {
    try { return JSON.parse(localStorage.getItem('admin_sub_tabs') || '{}'); } catch { return {}; }
  })();

  const [mainTab, setMainTab] = useState(savedMain);
  const [subTabs, setSubTabs] = useState({
    team: savedSubs.team || 'status',
    shop: savedSubs.shop || 'inventory',
    finance: savedSubs.finance || 'payroll',
    insights: savedSubs.insights || 'analytics',
    settings: savedSubs.settings || 'general',
  });

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
    pendingReorderRequests: 0
  });
  const [loading, setLoading] = useState(true);

  // Invoice link shortener (Admin Overview)
  const [shortUrlInput, setShortUrlInput] = useState('');
  const [shortUrlSlug, setShortUrlSlug] = useState('');
  const [shortUrlResult, setShortUrlResult] = useState(null);
  const [shortUrlLoading, setShortUrlLoading] = useState(false);
  const [shortUrlError, setShortUrlError] = useState('');

  const selectMainTab = (id) => {
    setMainTab(id);
    localStorage.setItem('admin_main_tab', id);
  };

  const selectSubTab = (main, sub) => {
    const updated = { ...subTabs, [main]: sub };
    setSubTabs(updated);
    localStorage.setItem('admin_sub_tabs', JSON.stringify(updated));
  };

  useEffect(() => {
    if (mainTab === 'overview') loadDashboardData();
  }, [mainTab]);

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
        pendingReorderRequests
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShortLink = async (e) => {
    e.preventDefault();
    if (!shortUrlInput.trim()) return;
    setShortUrlLoading(true);
    setShortUrlError('');
    try {
      const body = { target_url: shortUrlInput.trim() };
      if (shortUrlSlug.trim()) body.custom_slug = shortUrlSlug.trim();
      const res = await api.post('/links/shorten', body);
      const path = res.data.path || `/secure/${res.data.slug}`;
      const apiFull = res.data.full_url;
      const origin = window.location.origin;
      const base = apiFull && typeof apiFull === 'string' ? '' : origin;
      const fullUrl = apiFull || `${base}${path}`;
      setShortUrlResult({
        ...res.data,
        fullUrl,
      });
    } catch (err) {
      setShortUrlError(err.response?.data?.error || 'Failed to create short link');
      setShortUrlResult(null);
    } finally {
      setShortUrlLoading(false);
    }
  };

  // Pending approvals badge count for Team tab
  const teamBadgeCount = dashboardData.pendingTimeOff + dashboardData.unapprovedTimeEntries + dashboardData.tasksInReview;

  const renderOverview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600 dark:text-neutral-100">Loading...</span>
        </div>
      );
    }

    const urgentItems = [];
    if (dashboardData.overdueCompliance?.length > 0) {
      urgentItems.push({ type: 'error', icon: '🚨', message: `${dashboardData.overdueCompliance.length} overdue tax obligation(s)!`, action: () => { selectMainTab('finance'); selectSubTab('finance', 'compliance'); } });
    }
    if (dashboardData.pendingTimeOff > 0) {
      urgentItems.push({ type: 'warning', icon: '🏖️', message: `${dashboardData.pendingTimeOff} time off request(s) pending`, action: () => { selectMainTab('team'); selectSubTab('team', 'time'); } });
    }
    if (dashboardData.unapprovedTimeEntries > 0) {
      urgentItems.push({ type: 'warning', icon: '⏰', message: `${dashboardData.unapprovedTimeEntries} time entries need approval`, action: () => { selectMainTab('team'); selectSubTab('team', 'time'); } });
    }
    if (dashboardData.tasksInReview > 0) {
      urgentItems.push({ type: 'info', icon: '✅', message: `${dashboardData.tasksInReview} task(s) waiting for review`, action: () => navigate('/tasks?status=review') });
    }
    if (dashboardData.pendingReorderRequests > 0) {
      urgentItems.push({ type: 'warning', icon: '📦', message: `${dashboardData.pendingReorderRequests} reorder request(s) pending`, action: () => { selectMainTab('shop'); selectSubTab('shop', 'inventory'); } });
    }

    const allClear = urgentItems.length === 0 && dashboardData.worklistCompleted === dashboardData.worklistTotal;

    return (
      <div className="space-y-6 pt-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">{dashboardData.clockedInEmployees}<span className="text-base font-normal text-gray-400">/{dashboardData.totalEmployees}</span></p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Clocked In</p>
          </div>
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">{dashboardData.worklistCompleted}<span className="text-base font-normal text-gray-400">/{dashboardData.worklistTotal}</span></p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Tasks Done</p>
          </div>
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">{dashboardData.pendingTimeOff + dashboardData.unapprovedTimeEntries}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Pending Approvals</p>
          </div>
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">{dashboardData.overdueCompliance?.length || 0}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Overdue Items</p>
          </div>
        </div>

        {/* Status banner */}
        {allClear ? (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-5 text-white">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎉</span>
              <div>
                <h2 className="text-lg font-bold">All Caught Up!</h2>
                <p className="text-sm opacity-90">No urgent items. Great job staying on top of things!</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-5 text-white">
            <div className="flex items-center gap-4 mb-3">
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
                  className="w-full text-left bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg p-3 flex items-center gap-3 transition text-sm"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.message}</span>
                  <span className="ml-auto">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Today's work list */}
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100">📋 Today&apos;s Tasks</h3>
            <button
              onClick={() => { selectMainTab('team'); selectSubTab('team', 'worklist'); }}
              className="text-primary hover:text-primary/80 text-sm font-medium"
            >
              View full list →
            </button>
          </div>
          {!dashboardData.worklistItems?.length ? (
            <p className="text-gray-500 dark:text-neutral-400 text-sm py-2">No tasks for today.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {dashboardData.worklistItems
                .filter((i) => !i.is_completed)
                .slice(0, 10)
                .map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <span className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 dark:border-neutral-700" aria-hidden />
                    <span className="text-sm text-gray-800 dark:text-neutral-100 flex-1 min-w-0 truncate">{item.title}</span>
                  </li>
                ))}
              {dashboardData.worklistItems.filter((i) => i.is_completed).length > 0 && (
                <li className="pt-2 mt-2 border-t border-gray-100 dark:border-neutral-700 text-xs text-gray-500 dark:text-neutral-100">
                  ✓ {dashboardData.worklistItems.filter((i) => i.is_completed).length} completed
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Upcoming compliance */}
        {dashboardData.upcomingCompliance?.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100">🏛️ Upcoming Tax Deadlines</h3>
              <button onClick={() => { selectMainTab('finance'); selectSubTab('finance', 'compliance'); }} className="text-primary hover:text-primary-dark text-sm font-medium">
                View All →
              </button>
            </div>
            <div className="space-y-2">
              {dashboardData.upcomingCompliance.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-950 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-neutral-100 text-sm">{item.obligation_name}</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-100">Due: {new Date(item.due_date).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.days_until_due <= 7 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' : 'bg-primary-subtle dark:bg-primary/20 text-primary'}`}>
                    {item.days_until_due} days
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoice Link Shortener */}
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100">
                Invoice Link Shortener
              </h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                Paste the full payment or invoice URL and get a short link that looks like it&apos;s from your Spectrum domain.
              </p>
            </div>
          </div>
          <form onSubmit={handleCreateShortLink} className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-neutral-300">
                Full invoice / payment URL
              </label>
              <input
                type="url"
                value={shortUrlInput}
                onChange={(e) => setShortUrlInput(e.target.value)}
                placeholder="https://payments.provider.com/invoice/123..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-neutral-300">
                Custom short code (optional)
              </label>
              <div className="flex items-center gap-1">
                <span className="hidden md:inline text-xs text-gray-400">
                  /pay/
                </span>
                <input
                  type="text"
                  value={shortUrlSlug}
                  onChange={(e) => setShortUrlSlug(e.target.value)}
                  placeholder="truck-deposit-jan24"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Letters, numbers, and dashes only. Leave blank to auto‑generate.
              </p>
            </div>
            {shortUrlError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {shortUrlError}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={shortUrlLoading || !shortUrlInput.trim()}
                className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shortUrlLoading ? 'Creating link…' : 'Create short link'}
              </button>
              {shortUrlResult && (
                <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    type="text"
                    readOnly
                    value={shortUrlResult.fullUrl}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs text-gray-900 dark:text-neutral-100"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard && shortUrlResult.fullUrl) {
                        navigator.clipboard.writeText(shortUrlResult.fullUrl).catch(() => {});
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderTeam = () => {
    const sub = subTabs.team;
    return (
      <>
        <SubTabBar tabs={SUB_TABS.team} activeId={sub} onSelect={(id) => selectSubTab('team', id)} />
        {sub === 'status' && <EmployeeStatus />}
        {sub === 'schedule' && <ScheduleCalendar />}
        {sub === 'time' && <TimeApproval />}
        {sub === 'users' && <UserManagement />}
        {sub === 'worklist' && <AdminWorkList />}
        {sub === 'history' && <AdminHistory />}
      </>
    );
  };

  const renderShop = () => {
    const sub = subTabs.shop;
    return (
      <>
        <SubTabBar tabs={SUB_TABS.shop} activeId={sub} onSelect={(id) => selectSubTab('shop', id)} />
        {sub === 'inventory' && <InventoryManagement />}
        {sub === 'orders' && <OrderManagement />}
        {sub === 'products' && <ProductManagement />}
      </>
    );
  };

  const renderFinance = () => {
    const sub = subTabs.finance;
    return (
      <>
        <SubTabBar tabs={SUB_TABS.finance} activeId={sub} onSelect={(id) => selectSubTab('finance', id)} />
        {sub === 'payroll' && <PayrollManagement />}
        {sub === 'finance' && <FinanceDashboard />}
        {sub === 'compliance' && <ComplianceCenter />}
      </>
    );
  };

  const renderInsights = () => {
    const sub = subTabs.insights;
    return (
      <>
        <SubTabBar tabs={SUB_TABS.insights} activeId={sub} onSelect={(id) => selectSubTab('insights', id)} />
        {sub === 'analytics' && <Analytics />}
        {sub === 'reports' && <Reports />}
      </>
    );
  };

  const renderSettings = () => {
    const sub = subTabs.settings;
    return (
      <>
        <SubTabBar tabs={SUB_TABS.settings} activeId={sub} onSelect={(id) => selectSubTab('settings', id)} />
        {sub === 'general' && <Settings />}
        {sub === 'security' && <SecuritySessions />}
        {sub === 'updates' && <SystemUpdates />}
      </>
    );
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-neutral-100">Admin</h1>
        <div className="flex items-center gap-3">
          <p className="text-gray-500 dark:text-neutral-100 text-sm hidden sm:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <AdminBroadcastNotification />
        </div>
      </div>

      {/* Main tab bar */}
      <TabBar
        tabs={MAIN_TABS}
        activeId={mainTab}
        onSelect={selectMainTab}
        badge={{ tabId: 'team', count: teamBadgeCount }}
      />

      {/* Tab content */}
      <div className="pt-4">
        {mainTab === 'overview' && renderOverview()}
        {mainTab === 'team' && renderTeam()}
        {mainTab === 'shop' && renderShop()}
        {mainTab === 'finance' && renderFinance()}
        {mainTab === 'insights' && renderInsights()}
        {mainTab === 'settings' && renderSettings()}
      </div>
    </div>
  );
};

export default Admin;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ClockInOut from '../components/TimeClock/ClockInOut';
import api from '../utils/api';
import { formatDate, getUpcomingDayLabel, getTodayCentralTime, getLastCompletedWeekFridayHouston } from '../utils/helpers';
import TaskModal from '../components/Tasks/TaskModal';
import EmployeeTaskModal from '../components/Tasks/EmployeeTaskModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// ─── Helpers ────────────────────────────────────────────────

const getTaskUrgency = (task) => {
  if (task.status === 'completed') return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = task.due_date ? new Date(task.due_date) : null;
  due?.setHours(0, 0, 0, 0);
  const priority = (task.priority || '').toLowerCase();
  if (due && due < today) return 'critical';
  if (priority === 'critical') return 'critical';
  if (due && due.getTime() === today.getTime()) return 'high';
  if (priority === 'high') return 'high';
  const daysUntilDue = due ? Math.ceil((due - today) / (1000 * 60 * 60 * 24)) : 999;
  if (daysUntilDue <= 2) return 'high';
  if (daysUntilDue <= 7 || priority === 'medium') return 'medium';
  return 'low';
};

const urgencyStyles = {
  critical: 'border-l-4 border-l-red-500 bg-red-50/90 dark:bg-red-950/40 dark:border-l-red-400',
  high: 'border-l-4 border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/40 dark:border-l-amber-400',
  medium: 'border-l-4 border-l-primary bg-primary-subtle dark:bg-primary/20 dark:border-l-primary',
  low: 'border-l-4 border-l-neutral-300 bg-neutral-50/80 dark:bg-neutral-950/80 dark:border-l-neutral-500',
  none: 'border-l border-l-transparent'
};

const calculateTaskProgress = (task) => {
  if (task.status === 'completed') return 100;
  if (task.subtasks && task.subtasks.length > 0) {
    const done = task.subtasks.filter(st => st.is_completed === 1).length;
    const pct = (done / task.subtasks.length) * 100;
    let bonus = 0;
    if (task.status === 'review') bonus = 20;
    else if (task.status === 'in_progress' && task.started_at) bonus = 10;
    else if (task.status === 'in_progress') bonus = 5;
    return Math.min(100, Math.round(pct + bonus));
  }
  if (task.status === 'review') return 90;
  if (task.started_at && task.status === 'in_progress') {
    if (task.estimated_time_minutes) {
      const elapsed = (new Date() - new Date(task.started_at)) / (1000 * 60);
      return Math.round(Math.min(85, Math.max(50, (elapsed / task.estimated_time_minutes) * 100)));
    }
    return 50;
  }
  if (task.status === 'in_progress') return 25;
  return 0;
};

const fmt$ = (n) => {
  if (n == null || isNaN(n)) return '$0';
  return n < 0 ? `-$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const getGreeting = (user) => {
  if (!user) return 'Welcome';
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const name = user.full_name?.split(' ')[0] || user.username || 'there';
  if (day === 5 && hour >= 15) return `Have a great weekend, ${name}!`;
  if (hour >= 5 && hour < 12) return `Good morning, ${name}!`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${name}!`;
  if (hour >= 17 && hour < 22) return `Good evening, ${name}!`;
  return `Have a great night, ${name}!`;
};

const CHART_COLORS = ['#B8860B', '#1f2937', '#6b7280', '#d4a017', '#374151'];
const FIN_GREEN = '#16a34a';
const FIN_RED = '#dc2626';
const FIN_AMBER = '#d97706';

// ─── Dashboard ──────────────────────────────────────────────

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskLimit, setTaskLimit] = useState(8);

  // Shared state
  const [tasks, setTasks] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [myListItems, setMyListItems] = useState([]);
  const [myListSummary, setMyListSummary] = useState(null);
  const [newMyItem, setNewMyItem] = useState('');
  const [addingMyItem, setAddingMyItem] = useState(false);
  const [myListShowArchived, setMyListShowArchived] = useState(false);
  const [myListArchivedItems, setMyListArchivedItems] = useState([]);

  // Low stock alert
  const [lowStockCount, setLowStockCount] = useState(0);

  // Today revenue (admin only)
  const [todayRevenue, setTodayRevenue] = useState(null);
  const [todayRevenueLoading, setTodayRevenueLoading] = useState(true);

  // Employee-specific
  const [employeeStats, setEmployeeStats] = useState({ tasksTodo: 0, tasksInProgress: 0, tasksCompleted: 0, todayHours: 0, weekHours: 0 });

  // Admin-specific
  const [adminData, setAdminData] = useState({
    employeeStatuses: [],
    clockedIn: 0,
    totalEmployees: 0,
    pendingTimeOff: 0,
    unapprovedTime: 0,
    tasksInReview: 0,
    reorderRequests: 0,
    complianceOverdue: [],
    complianceDueSoon: [],
    pnl: null,
    worklistSummary: null,
    worklistItems: [],
  });

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchTodayRevenue = async () => {
      setTodayRevenueLoading(true);
      try {
        const res = await api.get('/dashboard/today-revenue');
        setTodayRevenue(res.data);
      } catch {
        setTodayRevenue({ total_revenue: 0, invoice_count: 0, error: true });
      } finally {
        setTodayRevenueLoading(false);
      }
    };
    fetchTodayRevenue();
    const interval = setInterval(fetchTodayRevenue, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const loadDashboardData = async () => {
    try {
      // All dates in Houston (America/Chicago) so dashboard matches your timezone
      const todayStr = getTodayCentralTime();
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 14);
      const endDateStr = endDate.toISOString().split('T')[0];

      // My List (all users)
      const myListPromise = api.get('/my-worklist/today').catch(() => ({ data: { items: [], summary: null } }));

      if (isAdmin) {
        const fridayStr = getLastCompletedWeekFridayHouston();

        const [
          tasksRes, scheduleRes, statusRes, worklistRes,
          complianceRes, reorderRes, lowStockRes, pnlRes, myListRes
        ] = await Promise.all([
          api.get('/tasks'),
          api.get('/schedule', { params: { start_date: todayStr, end_date: endDateStr } }).catch(() => ({ data: { entries: [] } })),
          api.get('/time/employees/status').catch(() => ({ data: [] })),
          api.get('/admin/worklist/today').catch(() => ({ data: { summary: null, allItems: [] } })),
          api.get('/compliance/dashboard').catch(() => ({ data: { overdue: [], dueSoon: [], upcoming: [] } })),
          api.get('/inventory/refill-requests/count', { params: { status: 'pending' } }).catch(() => ({ data: { count: 0 } })),
          api.get('/inventory/low-stock').catch(() => ({ data: { items: [] } })),
          api.get(`/compliance/pnl/weekly?week_ending_date=${fridayStr}`).catch(() => ({ data: null })),
          myListPromise,
        ]);

        const allTasks = tasksRes.data?.tasks || [];
        const rawEmp = statusRes.data?.employees || statusRes.data;
        const employees = Array.isArray(rawEmp) ? rawEmp : [];
        const compliance = complianceRes.data || {};
        const worklist = worklistRes.data || {};
        const wlItems = worklist.allItems || worklist.items || [];
        const pnl = pnlRes.data;
        setLowStockCount((lowStockRes.data?.items || []).length);

        const pendingTimeOff = (wlItems.filter(i => i.smart_key === 'pending_time_off' && !i.is_completed).length > 0)
          ? parseInt(wlItems.find(i => i.smart_key === 'pending_time_off')?.title?.match(/\d+/)?.[0] || 0) : 0;
        const unapprovedTime = (wlItems.filter(i => i.smart_key === 'unapproved_time_entries' && !i.is_completed).length > 0)
          ? parseInt(wlItems.find(i => i.smart_key === 'unapproved_time_entries')?.title?.match(/\d+/)?.[0] || 0) : 0;
        const tasksInReview = allTasks.filter(t => t.status === 'review').length;

        setAdminData({
          employeeStatuses: employees,
          clockedIn: employees.filter(e => e.status === 'clocked_in' || e.status === 'on_lunch').length,
          totalEmployees: employees.length,
          pendingTimeOff,
          unapprovedTime,
          tasksInReview,
          reorderRequests: reorderRes.data?.count || 0,
          complianceOverdue: compliance.overdue || [],
          complianceDueSoon: compliance.dueSoon || compliance.due_soon || [],
          pnl,
          worklistSummary: worklist.summary,
          worklistItems: wlItems.filter(i => !i.is_completed).slice(0, 5),
        });

        const sorted = [...allTasks].sort((a, b) => {
          const p = { in_progress: 1, review: 2, todo: 3, completed: 4 };
          if ((p[a.status] || 5) !== (p[b.status] || 5)) return (p[a.status] || 5) - (p[b.status] || 5);
          if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setTasks(sorted);
        setUpcomingEvents((scheduleRes.data?.entries || []).filter(e => e.status !== 'rejected'));
        setMyListItems(myListRes.data?.items || []);
        setMyListSummary(myListRes.data?.summary || null);
      } else {
        // Employee
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const [tasksRes, currentTimeRes, todayTimeRes, weekTimeRes, scheduleRes, myListRes] = await Promise.all([
          api.get('/tasks'),
          api.get('/time/current'),
          api.get('/time/entries/grouped', { params: { start_date: todayStr, end_date: todayStr } }),
          api.get('/time/entries/grouped', { params: { start_date: weekStartStr, end_date: todayStr } }),
          api.get('/schedule', { params: { start_date: todayStr, end_date: endDateStr } }).catch(() => ({ data: { entries: [] } })),
          myListPromise,
        ]);

        const allTasks = tasksRes.data.tasks || [];
        let todayHours = 0;
        if (currentTimeRes.data.clockedIn && currentTimeRes.data.totalElapsedMs !== undefined) {
          todayHours = currentTimeRes.data.totalElapsedMs / (1000 * 60 * 60);
        } else {
          const todayDay = todayTimeRes.data.days?.find(d => d.date === todayStr);
          todayHours = todayDay ? parseFloat(todayDay.totalHours) || 0 : 0;
        }
        const weekHours = (weekTimeRes.data.days || []).reduce((s, d) => s + (parseFloat(d.totalHours) || 0), 0);

        setEmployeeStats({
          tasksTodo: allTasks.filter(t => t.status === 'todo').length,
          tasksInProgress: allTasks.filter(t => t.status === 'in_progress').length,
          tasksCompleted: allTasks.filter(t => t.created_at?.startsWith(todayStr) && t.status === 'completed').length,
          todayHours,
          weekHours,
        });

        const sorted = [...allTasks].sort((a, b) => {
          const p = { in_progress: 1, review: 2, todo: 3, completed: 4 };
          if ((p[a.status] || 5) !== (p[b.status] || 5)) return (p[a.status] || 5) - (p[b.status] || 5);
          if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setTasks(sorted);
        setUpcomingEvents((scheduleRes.data?.entries || []).filter(e => e.status !== 'rejected'));
        setMyListItems(myListRes.data?.items || []);
        setMyListSummary(myListRes.data?.summary || null);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── My List inline handlers ──────────────────────────────

  const loadMyListArchived = async () => {
    try {
      const res = await api.get('/my-worklist/today', { params: { archived: 1 } });
      setMyListArchivedItems(res.data?.items || []);
    } catch { setMyListArchivedItems([]); }
  };

  const handleToggleMyItem = async (id) => {
    try {
      await api.post(`/my-worklist/items/${id}/toggle`);
      const res = await api.get('/my-worklist/today');
      setMyListItems(res.data?.items || []);
      setMyListSummary(res.data?.summary || null);
      if (myListShowArchived) await loadMyListArchived();
    } catch { /* silent */ }
  };

  const handleAddMyItem = async (e) => {
    e.preventDefault();
    if (!newMyItem.trim()) return;
    setAddingMyItem(true);
    try {
      await api.post('/my-worklist/items', { title: newMyItem.trim() });
      setNewMyItem('');
      const res = await api.get('/my-worklist/today');
      setMyListItems(res.data?.items || []);
      setMyListSummary(res.data?.summary || null);
    } catch { /* silent */ }
    finally { setAddingMyItem(false); }
  };

  // ─── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-neutral-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ═══════════════════════════════════════════════════════════

  if (isAdmin) {
    const { pnl, employeeStatuses, worklistSummary, worklistItems } = adminData;
    const revenue = pnl?.summary?.total_revenue || 0;
    const netProfit = pnl?.summary?.net_profit_loss || 0;
    const payrollCost = pnl?.summary?.payroll_cost || 0;
    const otherExpenses = pnl?.summary?.other_expenses || 0;
    const profitMargin = pnl?.summary?.profit_margin || 0;
    const comparison = pnl?.comparison;

    const openTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'archived').length;
    const pendingApprovals = adminData.unapprovedTime + adminData.pendingTimeOff + adminData.tasksInReview;

    // Daily revenue chart data
    const dailyRevenue = pnl?.revenue?.daily || [];
    const revenueChartData = dailyRevenue.map(d => ({
      day: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: d.revenue,
    }));

    // Task distribution for donut
    const taskDist = [
      { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length },
      { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length },
      { name: 'Review', value: tasks.filter(t => t.status === 'review').length },
      { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length },
    ].filter(d => d.value > 0);

    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100 md:text-2xl">Admin Dashboard</h1>
            <p className="text-sm font-medium text-gray-700 dark:text-neutral-100 mt-0.5">
              {user?.full_name || user?.username || 'Signed in'}
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400">Admin account</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}
            </p>
          </div>
          <button onClick={loadDashboardData} className="min-h-[2.5rem] px-3 py-1.5 text-sm text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">Refresh</button>
        </div>

        {/* ── Today Revenue ───────────────────────────────────── */}
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 dark:text-neutral-100 uppercase tracking-wider font-medium mb-1">Today's Revenue</p>
            {todayRevenueLoading ? (
              <div className="flex items-center gap-3">
                <div className="h-8 w-32 bg-gray-200 dark:bg-neutral-700 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-neutral-700 rounded animate-pulse" />
              </div>
            ) : (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {todayRevenue?.error && todayRevenue?.total_revenue === 0 ? '$--' : fmt$(todayRevenue?.total_revenue || 0)}
                </span>
                {todayRevenue && !todayRevenue.error && (
                  <span className="text-sm text-gray-500 dark:text-neutral-400">
                    {todayRevenue.invoice_count} invoice{todayRevenue.invoice_count !== 1 ? 's' : ''} today
                  </span>
                )}
                {todayRevenue?.error && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">Shopmonkey unavailable</span>
                )}
              </div>
            )}
          </div>
          <div className="text-3xl">💰</div>
        </div>

        {/* ── Key Metrics ────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Weekly Revenue" value={fmt$(revenue)} valueColor="text-green-600" sub={comparison ? `${comparison.change_percentage > 0 ? '+' : ''}${comparison.change_percentage.toFixed(0)}% vs last week` : null} subColor={comparison?.change_percentage >= 0 ? 'text-green-600' : 'text-red-600'} onClick={() => navigate('/admin?tab=compliance')} />
          <MetricCard label="On Clock" value={`${adminData.clockedIn}/${adminData.totalEmployees}`} sub="employees" onClick={() => navigate('/admin?tab=status')} />
          <MetricCard label="Open Tasks" value={openTasks} sub={`${adminData.tasksInReview} in review`} onClick={() => navigate('/tasks')} />
          <MetricCard label="Pending Approvals" value={pendingApprovals} sub={pendingApprovals > 0 ? 'needs attention' : 'all clear'} subColor={pendingApprovals > 0 ? 'text-amber-600' : 'text-green-600'} onClick={() => navigate('/admin?tab=worklist')} />
          <MetricCard label="Inventory" value={adminData.reorderRequests} sub={adminData.reorderRequests > 0 ? 'reorder requests' : 'no alerts'} subColor={adminData.reorderRequests > 0 ? 'text-amber-600' : 'text-green-600'} onClick={() => navigate('/admin?tab=inventory')} />
        </div>

        {/* ── Low Stock Alert ─────────────────────────────────── */}
        {lowStockCount > 0 && (
          <div
            className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
            onClick={() => navigate('/inventory')}
          >
            <span className="text-xl">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} low on stock
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Tap to view inventory and request reorders</p>
            </div>
            <span className="text-amber-500 text-lg">›</span>
          </div>
        )}

        {/* ── My List ────────────────────────────────────────── */}
        <MyListSection
          items={myListItems}
          summary={myListSummary}
          newItem={newMyItem}
          setNewItem={setNewMyItem}
          adding={addingMyItem}
          onAdd={handleAddMyItem}
          onToggle={handleToggleMyItem}
          onViewAll={() => navigate('/my-list')}
          showArchived={myListShowArchived}
          archivedItems={myListArchivedItems}
          onToggleShowArchived={async () => {
            const next = !myListShowArchived;
            setMyListShowArchived(next);
            if (next) await loadMyListArchived();
            else setMyListArchivedItems([]);
          }}
        />

        {/* ── Financial + Team (two columns) ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Financial Overview */}
          <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Financial Overview</h2>
              <button onClick={() => navigate('/admin?tab=compliance')} className="text-xs text-primary hover:underline">View P&amp;L</button>
            </div>
            {revenue > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-neutral-100 uppercase">Revenue</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{fmt$(revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-neutral-100 uppercase">Costs</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{fmt$(payrollCost + otherExpenses)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-neutral-100 uppercase">Net Profit</p>
                    <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{fmt$(netProfit)}</p>
                    <p className={`text-[10px] ${netProfit >= 0 ? 'text-green-500 dark:text-green-400/90' : 'text-red-500 dark:text-red-400/90'}`}>{profitMargin.toFixed(0)}% margin</p>
                  </div>
                </div>
                {revenueChartData.length > 0 && (
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueChartData} barSize={20}>
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip formatter={(v) => fmt$(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                        <Bar dataKey="revenue" fill={FIN_GREEN} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Cost breakdown bar */}
                <div className="mt-3">
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-neutral-700">
                    {payrollCost > 0 && <div className="transition-all" style={{ width: `${(payrollCost / revenue) * 100}%`, backgroundColor: FIN_RED }} title={`Payroll: ${fmt$(payrollCost)}`} />}
                    {otherExpenses > 0 && <div className="transition-all" style={{ width: `${(otherExpenses / revenue) * 100}%`, backgroundColor: FIN_AMBER }} title={`Expenses: ${fmt$(otherExpenses)}`} />}
                    {netProfit > 0 && <div className="transition-all" style={{ width: `${(netProfit / revenue) * 100}%`, backgroundColor: FIN_GREEN }} title={`Profit: ${fmt$(netProfit)}`} />}
                  </div>
                  <div className="flex justify-between mt-1 text-[9px]">
                    <span className="text-red-600 dark:text-red-400">Payroll {fmt$(payrollCost)}</span>
                    <span className="text-amber-600 dark:text-amber-400">Expenses {fmt$(otherExpenses)}</span>
                    <span className="text-green-600 dark:text-green-400">Profit {fmt$(netProfit)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-neutral-100 text-center py-4">No financial data for this week</p>
            )}
          </div>

          {/* Team Status */}
          <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Team Status</h2>
              <button onClick={() => navigate('/admin?tab=status')} className="text-xs text-primary hover:underline">View all</button>
            </div>
            {employeeStatuses.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {employeeStatuses.map(emp => (
                  <div key={emp.id || emp.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      emp.status === 'clocked_in' ? 'bg-green-500' :
                      emp.status === 'on_lunch' ? 'bg-amber-500' :
                      'bg-gray-300 dark:bg-neutral-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-neutral-100 truncate">{emp.full_name || emp.username}</p>
                      <p className="text-[10px] text-gray-400 dark:text-neutral-100">
                        {emp.status === 'clocked_in' ? `Working ${emp.hours_today ? emp.hours_today.toFixed(1) + 'h' : ''}` :
                         emp.status === 'on_lunch' ? 'On lunch' :
                         'Not clocked in'}
                      </p>
                    </div>
                    {emp.status === 'clocked_in' && emp.hours_today != null && (
                      <span className="text-xs font-medium text-gray-600 dark:text-neutral-100">{emp.hours_today.toFixed(1)}h</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-neutral-100 text-center py-4">No employee data</p>
            )}
          </div>
        </div>

        {/* ── Schedule + Compliance (two columns) ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Upcoming Schedule */}
          <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Upcoming Schedule</h2>
              <button onClick={() => navigate('/schedule')} className="text-xs text-primary hover:underline">View all</button>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {upcomingEvents.slice(0, 8).map(event => {
                  const dayLabel = getUpcomingDayLabel(event.start_date);
                  const label = event.is_shop_wide ? 'Shop Closed' : (event.reason || event.type || 'Event');
                  const who = event.is_shop_wide ? '' : (event.user_name || '');
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => navigate(`/schedule?view=${event.id}`)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 text-left transition cursor-pointer border-0"
                    >
                      <span className="text-xs font-semibold text-gray-600 dark:text-neutral-100 w-20 flex-shrink-0">{dayLabel}</span>
                      <span className="text-sm text-gray-800 dark:text-neutral-100 truncate flex-1">
                        {label}{who ? ` · ${who}` : ''}
                      </span>
                      {event.status === 'pending' && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">Pending</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-neutral-100 text-center py-4">No upcoming events</p>
            )}
          </div>

          {/* Compliance + Task Distribution */}
          <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Compliance & Tasks</h2>
              <button onClick={() => navigate('/admin?tab=compliance')} className="text-xs text-primary hover:underline">View all</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Compliance alerts */}
              <div>
                {adminData.complianceOverdue.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">{adminData.complianceOverdue.length} Overdue</span>
                    {adminData.complianceOverdue.slice(0, 2).map((c, i) => (
                      <p key={i} className="text-[11px] text-gray-600 dark:text-neutral-100 truncate">{c.obligation_name || c.name}</p>
                    ))}
                  </div>
                )}
                {adminData.complianceDueSoon.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{adminData.complianceDueSoon.length} Due Soon</span>
                    {adminData.complianceDueSoon.slice(0, 2).map((c, i) => (
                      <p key={i} className="text-[11px] text-gray-600 dark:text-neutral-100 truncate">{c.obligation_name || c.name}</p>
                    ))}
                  </div>
                )}
                {adminData.complianceOverdue.length === 0 && adminData.complianceDueSoon.length === 0 && (
                  <p className="text-sm text-green-600 font-medium">All clear</p>
                )}
              </div>
              {/* Task donut */}
              {taskDist.length > 0 && (
                <div className="flex items-center justify-center">
                  <div className="w-28 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={taskDist} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={2}>
                          {taskDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Admin Worklist Quick View ───────────────────────── */}
        {worklistSummary && (
          <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Admin Work List</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-neutral-100">{worklistSummary.completed}/{worklistSummary.total} done</span>
                <button onClick={() => navigate('/admin?tab=worklist')} className="text-xs text-primary hover:underline">Open</button>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${worklistSummary.progress}%` }} />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-neutral-100">{worklistSummary.progress}%</span>
            </div>
            {worklistItems.length > 0 && (
              <div className="space-y-1">
                {worklistItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-neutral-100 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tasks Overview ──────────────────────────────────── */}
        <TasksSection
          tasks={tasks}
          taskFilter={taskFilter}
          setTaskFilter={setTaskFilter}
          taskLimit={taskLimit}
          setTaskLimit={setTaskLimit}
          onTaskClick={setSelectedTask}
          navigate={navigate}
        />

        {/* ── Quick Navigation ────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { label: 'Schedule', icon: '📅', path: '/admin?tab=schedule' },
            { label: 'Employees', icon: '👥', path: '/admin?tab=status' },
            { label: 'Payroll', icon: '💰', path: '/admin?tab=payroll' },
            { label: 'Inventory', icon: '📦', path: '/admin?tab=inventory' },
            { label: 'Analytics', icon: '📊', path: '/admin?tab=analytics' },
            { label: 'Settings', icon: '⚙️', path: '/admin?tab=settings' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 p-3 bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition text-center"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium text-gray-600 dark:text-neutral-100">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Task Modals */}
        {selectedTask && (
          <TaskModal task={selectedTask} onClose={() => { setSelectedTask(null); loadDashboardData(); }} />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // EMPLOYEE DASHBOARD
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-neutral-100">{getGreeting(user)}</h1>
        <p className="text-gray-500 dark:text-neutral-400 text-sm mt-0.5">Your dashboard</p>
      </div>

      {/* Clock In/Out */}
      <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 md:p-5">
        <ClockInOut />
      </div>

      {/* My List */}
      <MyListSection
        items={myListItems}
        summary={myListSummary}
        newItem={newMyItem}
        setNewItem={setNewMyItem}
        adding={addingMyItem}
        onAdd={handleAddMyItem}
        onToggle={handleToggleMyItem}
        onViewAll={() => navigate('/my-list')}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="To Do" value={employeeStats.tasksTodo} onClick={() => navigate('/tasks?status=todo')} />
        <MetricCard label="In Progress" value={employeeStats.tasksInProgress} onClick={() => navigate('/tasks?status=in_progress')} />
        <MetricCard label="Completed Today" value={employeeStats.tasksCompleted} onClick={() => navigate('/tasks?status=completed')} />
        <MetricCard label="Today&apos;s Hours" value={employeeStats.todayHours.toFixed(1)} sub="hours" onClick={() => navigate('/time')} />
        <MetricCard label="Week Hours" value={employeeStats.weekHours.toFixed(1)} sub="hours" onClick={() => navigate('/time')} />
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Upcoming Events</h2>
            <button onClick={() => navigate('/schedule')} className="text-xs text-primary hover:underline">View Schedule</button>
          </div>
          <div className="space-y-1.5">
            {upcomingEvents.slice(0, 8).map(event => {
              const dayLabel = getUpcomingDayLabel(event.start_date);
              const label = event.is_shop_wide ? 'Shop Closed' : (event.reason || event.type || 'Event');
              const who = event.is_shop_wide ? '' : (event.user_name || '');
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => navigate(`/schedule?view=${event.id}`)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 text-left transition cursor-pointer border-0"
                >
                  <span className="text-xs font-semibold text-gray-600 dark:text-neutral-400 w-20 flex-shrink-0">{dayLabel}</span>
                  <span className="text-sm text-gray-800 dark:text-neutral-100 truncate flex-1">{label}{who ? ` · ${who}` : ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tasks Overview */}
      <TasksSection
        tasks={tasks}
        taskFilter={taskFilter}
        setTaskFilter={setTaskFilter}
        taskLimit={taskLimit}
        setTaskLimit={setTaskLimit}
        onTaskClick={setSelectedTask}
        navigate={navigate}
      />

      {/* Task Modals */}
      {selectedTask && (
        <EmployeeTaskModal task={selectedTask} onClose={() => { setSelectedTask(null); loadDashboardData(); }} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════

const MetricCard = ({ label, value, valueColor, sub, subColor, onClick }) => (
  <button
    onClick={onClick}
    className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 text-left hover:border-primary/30 hover:bg-primary/5 transition w-full"
  >
    <p className="text-[10px] text-gray-500 dark:text-neutral-100 uppercase tracking-wider font-medium">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${valueColor || 'text-gray-800 dark:text-neutral-100'}`}>{value}</p>
    {sub && <p className={`text-[11px] mt-0.5 ${subColor || 'text-gray-400 dark:text-neutral-100'}`}>{sub}</p>}
  </button>
);

const MyListSection = ({
  items,
  summary,
  newItem,
  setNewItem,
  adding,
  onAdd,
  onToggle,
  onViewAll,
  showArchived = false,
  archivedItems = [],
  onToggleShowArchived,
}) => {
  const pending = items.filter(i => !i.is_completed);
  const done = items.filter(i => i.is_completed);

  return (
    <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">My List</h2>
          {summary && summary.total > 0 && !showArchived && (
            <span className="text-[10px] text-gray-400 dark:text-neutral-100">{summary.completed}/{summary.total}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggleShowArchived && (
            <button
              type="button"
              onClick={onToggleShowArchived}
              className="text-xs text-gray-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
          )}
          <button onClick={onViewAll} className="text-xs text-primary hover:underline">View all</button>
        </div>
      </div>

      {!showArchived && (
        <>
          {/* Quick add */}
          <form onSubmit={onAdd} className="flex gap-2 mb-3">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add a task..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 dark:placeholder-neutral-400 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
            />
            <button type="submit" disabled={!newItem.trim() || adding} className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 shrink-0">
              {adding ? '...' : 'Add'}
            </button>
          </form>

          {/* Active items */}
          {pending.length > 0 && (
            <div className="space-y-1 mb-2">
              {pending.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-2.5 py-1.5 group">
                  <button
                    onClick={() => onToggle(item.id)}
                    className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-neutral-500 hover:border-primary flex items-center justify-center transition dark:bg-neutral-950"
                  />
                  <span className="text-sm text-gray-700 dark:text-neutral-100 truncate flex-1">{item.title}</span>
                </div>
              ))}
              {pending.length > 5 && (
                <button onClick={onViewAll} className="text-xs text-gray-400 dark:text-neutral-100 hover:text-primary">+ {pending.length - 5} more</button>
              )}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-1 opacity-75">
              {done.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center gap-2.5 py-1">
                  <button
                    onClick={() => onToggle(item.id)}
                    className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 border-2 border-green-500 text-white flex items-center justify-center"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <span className="text-sm text-gray-400 dark:text-neutral-100 line-through truncate flex-1">{item.title}</span>
                </div>
              ))}
            </div>
          )}
          {items.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-neutral-100 text-center py-2">No items yet. Add one above. Completed items are archived after 24 hours.</p>
          )}
        </>
      )}

      {/* Archived list (when toggled) — uncheck to restore to My List */}
      {showArchived && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2">Uncheck an item to bring it back to your list.</p>
          {archivedItems.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-neutral-100 text-center py-2">No archived items.</p>
          ) : (
            archivedItems.map(item => (
              <div key={item.id} className="flex items-center gap-2.5 py-1.5">
                <button
                  onClick={() => onToggle(item.id)}
                  className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 border-2 border-green-500 text-white flex items-center justify-center hover:opacity-90"
                  title="Uncheck to restore to My List"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </button>
                <span className="text-sm text-gray-500 dark:text-neutral-100 line-through truncate flex-1">{item.title}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const TasksSection = ({ tasks, taskFilter, setTaskFilter, taskLimit, setTaskLimit, onTaskClick, navigate }) => {
  const filtered = taskFilter === 'all' ? tasks : tasks.filter(t => t.status === taskFilter);
  const displayed = filtered.slice(0, taskLimit);
  const hasMore = filtered.length > taskLimit;

  return (
    <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Tasks Overview</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gray-100 dark:bg-neutral-950 rounded-lg p-0.5">
            {['all', 'in_progress', 'review', 'todo', 'completed'].map(key => (
              <button
                key={key}
                onClick={() => { setTaskFilter(key); setTaskLimit(8); }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition ${taskFilter === key ? 'bg-primary text-white shadow-sm' : 'text-gray-500 dark:text-neutral-100 hover:text-gray-700 dark:hover:text-neutral-100'}`}
              >
                {key === 'all' ? 'All' : key === 'in_progress' ? 'Active' : key === 'review' ? 'Review' : key === 'todo' ? 'To Do' : 'Done'}
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/tasks')} className="text-xs text-primary hover:underline">View all</button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-neutral-100 text-center py-6">No tasks</p>
      ) : (
        <div className="space-y-1.5">
          {displayed.map(task => {
            const progress = calculateTaskProgress(task);
            const urgency = getTaskUrgency(task);
            const uClass = urgencyStyles[urgency] || '';
            return (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:opacity-90 transition border border-gray-100 dark:border-neutral-700 ${uClass}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-neutral-100 truncate">{task.title}</span>
                    {task.category && <span className="text-[10px] text-gray-400 dark:text-neutral-100 flex-shrink-0">{task.category}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-500 dark:text-neutral-100">{task.assigned_to_name || 'Unassigned'}</span>
                    {task.due_date && (
                      <span className={`text-[11px] ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-neutral-100'}`}>
                        Due {formatDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-neutral-100 w-7 text-right">{progress}%</span>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button onClick={() => setTaskLimit(taskLimit + 8)} className="w-full py-2 text-xs text-gray-500 dark:text-neutral-100 hover:text-gray-700 dark:hover:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-lg transition">
              Show more ({filtered.length - taskLimit} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;

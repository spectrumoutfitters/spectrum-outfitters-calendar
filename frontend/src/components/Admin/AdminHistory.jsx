import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
const formatTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const formatDateTime = (d) => d ? new Date(d).toLocaleString() : '—';

export default function AdminHistory() {
  const [view, setView] = useState('lunch'); // 'lunch' | 'punch'
  const [lunches, setLunches] = useState([]);
  const [punches, setPunches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [userId, setUserId] = useState('');
  const [punchType, setPunchType] = useState(''); // '' | clock_in | clock_out | lunch_out | lunch_in
  const [users, setUsers] = useState([]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/time/employees/status');
      const list = res.data || [];
      setUsers(list.map(e => ({ id: e.id, name: e.full_name || e.username })));
    } catch (_) {
      setUsers([]);
    }
  }, []);

  const loadLunchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from, to };
      if (userId) params.user_id = userId;
      const res = await api.get('/time/lunch-history', { params });
      setLunches(res.data.lunches || []);
    } catch (err) {
      console.error('Lunch history error:', err);
      setLunches([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, userId]);

  const loadPunchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from: from + 'T00:00:00.000Z', to: to + 'T23:59:59.999Z' };
      if (userId) params.user_id = userId;
      const res = await api.get('/time/punch-history', { params });
      let list = res.data.punches || [];
      if (punchType) list = list.filter(p => p.type === punchType);
      setPunches(list);
    } catch (err) {
      console.error('Punch history error:', err);
      setPunches([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, userId, punchType]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (view === 'lunch') loadLunchHistory();
    else loadPunchHistory();
  }, [view, loadLunchHistory, loadPunchHistory]);

  const typeLabel = (t) => {
    switch (t) {
      case 'clock_in': return 'Clock In';
      case 'clock_out': return 'Clock Out';
      case 'lunch_out': return 'Lunch Out';
      case 'lunch_in': return 'Lunch In';
      default: return t;
    }
  };

  const typeBadge = (t) => {
    const c = t === 'clock_in' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : t === 'clock_out' ? 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100' : t === 'lunch_out' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c}`}>{typeLabel(t)}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-neutral-100">Time &amp; Lunch History</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView('lunch')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${view === 'lunch' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100 hover:bg-gray-200 dark:hover:bg-neutral-600'}`}
          >
            Lunch clock-out / clock-in
          </button>
          <button
            onClick={() => setView('punch')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${view === 'punch' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100 hover:bg-gray-200 dark:hover:bg-neutral-600'}`}
          >
            All punches
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600 dark:text-neutral-100">From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100" />
        <label className="text-sm text-gray-600 dark:text-neutral-100">To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100" />
        <label className="text-sm text-gray-600 dark:text-neutral-100">Employee</label>
        <select value={userId} onChange={e => setUserId(e.target.value)} className="border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm min-w-[160px] bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100">
          <option value="">All</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {view === 'punch' && (
          <>
            <label className="text-sm text-gray-600 dark:text-neutral-100">Type</label>
            <select value={punchType} onChange={e => setPunchType(e.target.value)} className="border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100">
              <option value="">All</option>
              <option value="clock_in">Clock In</option>
              <option value="clock_out">Clock Out</option>
              <option value="lunch_out">Lunch Out</option>
              <option value="lunch_in">Lunch In</option>
            </select>
          </>
        )}
        <button onClick={() => (view === 'lunch' ? loadLunchHistory() : loadPunchHistory())} className="px-4 py-2 bg-gray-800 dark:bg-neutral-600 text-white text-sm rounded-lg hover:bg-gray-700 dark:hover:bg-neutral-500">
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-400">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-neutral-700 border-t-primary"></div>
          <span>Loading...</span>
        </div>
      )}

      {view === 'lunch' && !loading && (
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-700">
            <h3 className="font-semibold text-gray-800 dark:text-neutral-100">Lunch clock-out and clock-in</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">When each employee went to lunch and when they returned.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-950">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-neutral-100">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-neutral-100">Employee</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-neutral-100">Lunch out</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-neutral-100">Lunch in</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-neutral-100">Duration</th>
                </tr>
              </thead>
              <tbody>
                {lunches.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-500 dark:text-neutral-400">No lunch records in this range.</td></tr>
                ) : lunches.map(l => (
                  <tr key={l.id} className="border-t border-gray-50 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="py-3 px-4 text-gray-600 dark:text-neutral-100">{formatDate(l.date)}</td>
                    <td className="py-3 px-4 font-medium text-gray-800 dark:text-neutral-100">{l.userName}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-neutral-100">{formatDateTime(l.lunchOut)}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-neutral-100">{l.lunchIn ? formatDateTime(l.lunchIn) : '—'}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-neutral-100">{l.durationMinutes != null ? `${l.durationMinutes} min` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'punch' && !loading && (
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-700">
            <h3 className="font-semibold text-gray-800 dark:text-neutral-100">All punch history</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">Clock in, clock out, lunch out, and lunch in events in order.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-950">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-neutral-100">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-neutral-100">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-neutral-100">Employee</th>
                </tr>
              </thead>
              <tbody>
                {punches.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-gray-500 dark:text-neutral-400">No punches in this range.</td></tr>
                ) : punches.map((p, i) => (
                  <tr key={`${p.entryId}-${p.time}-${i}`} className="border-t border-gray-50 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="py-3 px-4 text-gray-600 dark:text-neutral-100 whitespace-nowrap">{formatDateTime(p.time)}</td>
                    <td className="py-3 px-4">{typeBadge(p.type)}</td>
                    <td className="py-3 px-4 font-medium text-gray-800 dark:text-neutral-100">{p.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 dark:text-neutral-400">
        Login and logout history is in <strong className="text-gray-800 dark:text-neutral-100">Admin → Security &amp; Sessions</strong> under the &quot;Login History&quot; tab (filter by &quot;All (login &amp; logout)&quot; or &quot;Logout only&quot;).
      </p>
    </div>
  );
}

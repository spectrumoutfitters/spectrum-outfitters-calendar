import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

const SecuritySessions = () => {
  const [view, setView] = useState('overview');
  const [stats, setStats] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loginEvents, setLoginEvents] = useState([]);
  const [loginTotal, setLoginTotal] = useState(0);
  const [config, setConfig] = useState({ allowedIPs: [], geofence: null });
  const [loading, setLoading] = useState(true);
  const [eventsPage, setEventsPage] = useState(0);
  const [filterUser, setFilterUser] = useState('');
  const [filterSuccess, setFilterSuccess] = useState('');
  const PAGE_SIZE = 50;

  // Config form state
  const [editIPs, setEditIPs] = useState('');
  const [editGeoLat, setEditGeoLat] = useState('');
  const [editGeoLng, setEditGeoLng] = useState('');
  const [editGeoRadius, setEditGeoRadius] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/security/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load security stats:', err);
    }
  }, []);

  const loadActiveSessions = useCallback(async () => {
    try {
      const res = await api.get('/admin/security/active-sessions');
      setActiveSessions(res.data.sessions || []);
    } catch (err) {
      console.error('Failed to load active sessions:', err);
    }
  }, []);

  const [filterEventType, setFilterEventType] = useState(''); // '' | 'login' | 'logout' for auth-history

  const loadLoginEvents = useCallback(async (page = 0) => {
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (filterUser) params.user_id = filterUser;
      if (filterSuccess !== '') params.success = filterSuccess;
      if (filterEventType) params.event_type = filterEventType;
      const res = await api.get('/admin/security/auth-history', { params });
      setLoginEvents(res.data.events || []);
      setLoginTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load auth history:', err);
      try {
        const fallback = await api.get('/admin/security/login-events', { params: { limit: PAGE_SIZE, offset: page * PAGE_SIZE, ...(filterUser && { user_id: filterUser }), ...(filterSuccess !== '' && { success: filterSuccess }) } });
        setLoginEvents(fallback.data.events || []);
        setLoginTotal(fallback.data.total || 0);
      } catch (e2) {
        setLoginEvents([]);
        setLoginTotal(0);
      }
    }
  }, [filterUser, filterSuccess, filterEventType]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.get('/admin/security/on-prem-config');
      setConfig(res.data);
      setEditIPs((res.data.allowedIPs || []).join('\n'));
      if (res.data.geofence) {
        setEditGeoLat(String(res.data.geofence.lat));
        setEditGeoLng(String(res.data.geofence.lng));
        setEditGeoRadius(String(res.data.geofence.radiusMeters));
      }
    } catch (err) {
      console.error('Failed to load on-prem config:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadActiveSessions(), loadConfig()]);
      setLoading(false);
    })();
  }, [loadStats, loadActiveSessions, loadConfig]);

  useEffect(() => {
    if (view === 'events') loadLoginEvents(eventsPage);
  }, [view, eventsPage, loadLoginEvents]);

  // Auto-refresh active sessions every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadActiveSessions();
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadActiveSessions, loadStats]);

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const allowedIPs = editIPs.split('\n').map(s => s.trim()).filter(Boolean);
      const geofence = editGeoLat && editGeoLng && editGeoRadius
        ? { lat: parseFloat(editGeoLat), lng: parseFloat(editGeoLng), radiusMeters: parseFloat(editGeoRadius) }
        : null;
      const res = await api.put('/admin/security/on-prem-config', { allowedIPs, geofence });
      setConfig(res.data);
      setConfigMsg('Configuration saved.');
    } catch (err) {
      setConfigMsg('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setConfigSaving(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Delete login events older than 90 days?')) return;
    try {
      const res = await api.delete('/admin/security/login-events', { params: { olderThanDays: 90 } });
      alert(`Purged ${res.data.deleted} old events.`);
      loadLoginEvents(eventsPage);
      loadStats();
    } catch (err) {
      alert('Failed to purge: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts + (ts.endsWith('Z') ? '' : 'Z')).toLocaleString();
  };

  const timeAgo = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const parseUA = (ua) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Electron')) return 'Desktop Assistant';
    if (ua.includes('Mobile')) return 'Mobile';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return 'Browser';
  };

  const scoreBadge = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-gray-600">Loading security data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Sessions" value={stats.activeSessions} color="bg-green-50 text-green-700 border-green-200" />
          <StatCard label="Logins Today" value={stats.loginsToday} color="bg-blue-50 text-blue-700 border-blue-200" />
          <StatCard label="Failed (24h)" value={stats.failedLast24h} color={stats.failedLast24h > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-neutral-950 text-gray-700 dark:text-neutral-100 border-gray-200 dark:border-neutral-700'} />
          <StatCard label="Unique IPs Today" value={stats.uniqueIPsToday} color="bg-purple-50 text-purple-700 border-purple-200" />
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'overview', label: 'Active Sessions' },
          { id: 'events', label: 'Login History' },
          { id: 'config', label: 'On-Prem Config' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setView(tab.id); if (tab.id === 'events') loadLoginEvents(0); }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              view === tab.id ? 'bg-white dark:bg-neutral-950 border border-b-0 border-gray-200 dark:border-neutral-700 text-primary' : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Sessions */}
      {view === 'overview' && (
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Currently Active Sessions</h3>
            <button onClick={loadActiveSessions} className="text-xs text-primary hover:underline">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-950">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">IP Address</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Device</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Connected</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">No active sessions</td></tr>
                ) : activeSessions.map(s => (
                  <tr key={s.id} className="border-t border-gray-50 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{s.full_name}</div>
                      <div className="text-xs text-gray-500">@{s.username}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100'}`}>
                        {s.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.online ? 'text-green-600' : 'text-yellow-600'}`}>
                        <span className={`w-2 h-2 rounded-full ${s.online ? 'bg-green-500' : 'bg-yellow-400'}`}></span>
                        {s.online ? 'Online' : 'Idle'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-700">{s.ip || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{parseUA(s.user_agent)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatTime(s.started_at)}</td>
                    <td className="py-3 px-4 text-gray-600">{timeAgo(s.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Login History */}
      {view === 'events' && (
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
            <h3 className="font-semibold text-gray-800">Login Event History</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterEventType}
                onChange={e => { setFilterEventType(e.target.value); setEventsPage(0); }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">All (login & logout)</option>
                <option value="login">Login only</option>
                <option value="logout">Logout only</option>
              </select>
              <select
                value={filterSuccess}
                onChange={e => { setFilterSuccess(e.target.value); setEventsPage(0); }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">All results</option>
                <option value="1">Success</option>
                <option value="0">Failed</option>
              </select>
              <button onClick={handlePurge} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                Purge 90d+
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-950">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Event</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Result</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">VPN</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">IP</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Device</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">IP Location</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Browser Geo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">On-Prem</th>
                </tr>
              </thead>
              <tbody>
                {loginEvents.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-500">No events found</td></tr>
                ) : loginEvents.map(ev => {
                  const isLocalIp = !ev.ip || ev.ip === '127.0.0.1' || ev.ip === '::1' || String(ev.ip).includes('127.0.0.1');
                  const ipLocation = ev.event_type === 'logout' ? '—' : (isLocalIp ? 'Local' : (ev.ip_geo_city ? `${ev.ip_geo_city}, ${ev.ip_geo_region || ''} ${ev.ip_geo_country || ''}`.trim() : '-'));
                  return (
                  <tr key={`${ev.event_type || 'login'}-${ev.id}`} className="border-t border-gray-50 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{formatTime(ev.occurred_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ev.event_type === 'logout' ? 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                        {ev.event_type === 'logout' ? 'Logout' : 'Login'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{ev.full_name || ev.username}</div>
                      {ev.reason && <div className="text-xs text-gray-400">{ev.reason}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ev.success ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ev.event_type === 'logout' ? 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-100' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                        {ev.event_type === 'logout' ? '—' : (ev.success ? 'Success' : 'Failed')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {ev.event_type === 'logout' ? '—' : (ev.is_vpn ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="VPN/proxy detected">VPN</span> : '—')}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-700">{ev.ip || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{parseUA(ev.user_agent)}</td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {ipLocation}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {ev.event_type === 'logout' ? '—' : (ev.browser_geo_lat != null
                        ? `${ev.browser_geo_lat.toFixed(4)}, ${ev.browser_geo_lng.toFixed(4)} (${Math.round(ev.browser_geo_accuracy_m || 0)}m)`
                        : '-')}
                    </td>
                    <td className="py-3 px-4">
                      {ev.event_type === 'logout' ? '—' : (
                        <>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${scoreBadge(ev.on_prem_score)}`}>
                            {ev.on_prem_score}%
                          </span>
                          <div className="flex gap-1 mt-1">
                            {ev.on_prem_network_ok ? <span className="text-[10px] text-green-600">NET</span> : <span className="text-[10px] text-red-400">NET</span>}
                            {ev.on_prem_geo_ok ? <span className="text-[10px] text-green-600">GEO</span> : <span className="text-[10px] text-red-400">GEO</span>}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {loginTotal > PAGE_SIZE && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Showing {eventsPage * PAGE_SIZE + 1}-{Math.min((eventsPage + 1) * PAGE_SIZE, loginTotal)} of {loginTotal}
              </span>
              <div className="flex gap-2">
                <button disabled={eventsPage === 0} onClick={() => setEventsPage(p => p - 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-40">Prev</button>
                <button disabled={(eventsPage + 1) * PAGE_SIZE >= loginTotal} onClick={() => setEventsPage(p => p + 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* On-Prem Configuration */}
      {view === 'config' && (
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6 max-w-2xl">
          <h3 className="font-semibold text-gray-800 mb-4">On-Premises Verification Settings</h3>
          <p className="text-sm text-gray-500 mb-6">
            Configure which IP addresses and geographic zones count as "on-prem" for login scoring.
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allowed IPs / CIDRs (one per line)</label>
              <textarea
                rows={4}
                value={editIPs}
                onChange={e => setEditIPs(e.target.value)}
                placeholder={"165.245.137.192\n10.0.0.0/8"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Public IPs or CIDR blocks. Logins from these IPs get 50 pts toward on-prem score.</p>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Geofence (shop location)</label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Latitude</label>
                  <input type="number" step="any" value={editGeoLat} onChange={e => setEditGeoLat(e.target.value)}
                    placeholder="33.4484" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Longitude</label>
                  <input type="number" step="any" value={editGeoLng} onChange={e => setEditGeoLng(e.target.value)}
                    placeholder="-112.0740" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Radius (meters)</label>
                  <input type="number" value={editGeoRadius} onChange={e => setEditGeoRadius(e.target.value)}
                    placeholder="200" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Browser GPS within this radius earns 30 pts. Leave all blank to disable geofence.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
                className="btn-primary px-6 py-2 text-sm"
              >
                {configSaving ? 'Saving...' : 'Save Configuration'}
              </button>
              {configMsg && <span className="text-sm text-gray-600">{configMsg}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div className={`rounded-xl border p-4 ${color}`}>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
  </div>
);

export default SecuritySessions;

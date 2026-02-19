const api = window.monitorApi;

const healthBadge = document.getElementById('healthBadge');
const healthBadgeOk = document.getElementById('healthBadgeOk');
const settingsPanel = document.getElementById('settingsPanel');
const btnSettings = document.getElementById('btnSettings');
const btnSaveConfig = document.getElementById('btnSaveConfig');
const btnRefresh = document.getElementById('btnRefresh');
const inputApiUrl = document.getElementById('inputApiUrl');
const inputToken = document.getElementById('inputToken');
const errorBox = document.getElementById('errorBox');
const lastUpdate = document.getElementById('lastUpdate');
const statsRow = document.getElementById('statsRow');
const sessionsBody = document.getElementById('sessionsBody');
const eventsBody = document.getElementById('eventsBody');

let refreshInterval = null;

function showError(msg) {
  errorBox.textContent = msg || '';
  errorBox.style.display = msg ? 'block' : 'none';
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = new Date(ts + (String(ts).endsWith('Z') ? '' : 'Z'));
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function deviceLabel(ua) {
  if (!ua) return '—';
  if (ua.includes('Electron')) return 'Desktop';
  if (ua.includes('Mobile')) return 'Mobile';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Browser';
}

async function loadConfig() {
  const cfg = await api.getConfig();
  inputApiUrl.value = cfg.apiBaseUrl || '';
  inputToken.value = cfg.apiToken || '';
}

async function refresh() {
  const cfg = await api.getConfig();
  if (!cfg.apiBaseUrl?.trim()) {
    showError('Set API Base URL in Settings (e.g. https://login.spectrumoutfitters.com/api).');
    healthBadge.style.display = 'none';
    healthBadgeOk.style.display = 'none';
    return;
  }
  showError('');

  try {
    const base = cfg.apiBaseUrl.replace(/\/+$/, '');
    const token = cfg.apiToken?.trim() || '';

    const [health, stats, sessions, events] = await Promise.all([
      api.fetch(base + '/health', token).catch(() => null),
      api.fetch(base + '/admin/security/stats', token).catch(() => null),
      api.fetch(base + '/admin/security/active-sessions', token).catch(() => null),
      api.fetch(base + '/admin/security/login-events?limit=50', token).catch(() => null)
    ]);

    if (health?.status === 'ok') {
      healthBadge.style.display = 'none';
      healthBadgeOk.style.display = 'inline';
    } else {
      healthBadgeOk.style.display = 'none';
      healthBadge.style.display = 'inline';
    }

    if (stats) {
      statsRow.innerHTML = `
        <div class="stat-card"><div class="stat-value">${stats.activeSessions ?? 0}</div><div class="stat-label">Active sessions</div></div>
        <div class="stat-card"><div class="stat-value">${stats.loginsToday ?? 0}</div><div class="stat-label">Logins today</div></div>
        <div class="stat-card"><div class="stat-value">${stats.failedLast24h ?? 0}</div><div class="stat-label">Failed (24h)</div></div>
        <div class="stat-card"><div class="stat-value">${stats.uniqueIPsToday ?? 0}</div><div class="stat-label">Unique IPs today</div></div>
      `;
    } else {
      statsRow.innerHTML = '';
    }

    const sessionList = sessions?.sessions || [];
    if (sessionList.length === 0) {
      sessionsBody.innerHTML = '<tr><td colspan="6" class="empty">No active sessions</td></tr>';
    } else {
      sessionsBody.innerHTML = sessionList.map(s => `
        <tr>
          <td><strong>${s.full_name || s.username}</strong><br><span class="muted">@${s.username}</span></td>
          <td>${s.role || '—'}</td>
          <td><span class="status-dot ${s.online ? 'status-online' : 'status-idle'}"></span>${s.online ? 'Online' : 'Idle'}</td>
          <td><code>${s.ip || '—'}</code></td>
          <td>${deviceLabel(s.user_agent)}</td>
          <td>${timeAgo(s.last_seen_at)}</td>
        </tr>
      `).join('');
    }

    const eventList = events?.events || [];
    if (eventList.length === 0) {
      eventsBody.innerHTML = '<tr><td colspan="6" class="empty">No login events yet. Log out and log in again on the site to record events.</td></tr>';
    } else {
      eventsBody.innerHTML = eventList.map(ev => {
        const ts = ev.occurred_at ? new Date(ev.occurred_at + (String(ev.occurred_at).endsWith('Z') ? '' : 'Z')).toLocaleString() : '—';
        const loc = ev.ip_geo_city ? [ev.ip_geo_city, ev.ip_geo_region, ev.ip_geo_country].filter(Boolean).join(', ') : '—';
        const resultClass = ev.success ? 'status-ok' : 'status-fail';
        return `
          <tr>
            <td class="muted">${ts}</td>
            <td>${ev.full_name || ev.username}</td>
            <td><span class="${resultClass}">${ev.success ? 'OK' : 'FAIL'}</span></td>
            <td><code>${ev.ip || '—'}</code></td>
            <td>${loc}</td>
            <td>${ev.on_prem_score ?? '—'}%</td>
          </tr>
        `;
      }).join('');
    }

    lastUpdate.textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (err) {
    showError('Error: ' + (err?.message || err));
    healthBadgeOk.style.display = 'none';
    healthBadge.style.display = 'inline';
    lastUpdate.textContent = '';
  }
}

btnSettings.addEventListener('click', () => {
  settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
  if (settingsPanel.style.display === 'block') loadConfig();
});

btnSaveConfig.addEventListener('click', async () => {
  await api.setConfig({
    apiBaseUrl: inputApiUrl.value.trim(),
    apiToken: inputToken.value.trim()
  });
  settingsPanel.style.display = 'none';
  refresh();
});

btnRefresh.addEventListener('click', () => refresh());

(async () => {
  await loadConfig();
  await refresh();
  refreshInterval = setInterval(refresh, 20000);
})();

window.addEventListener('beforeunload', () => {
  if (refreshInterval) clearInterval(refreshInterval);
});

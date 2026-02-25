const api = window.monitorApi;

const pageTitle = document.getElementById('pageTitle');
const healthBadge = document.getElementById('healthBadge');
const healthBadgeOk = document.getElementById('healthBadgeOk');
const lastUpdate = document.getElementById('lastUpdate');
const errorBox = document.getElementById('errorBox');
const statsRow = document.getElementById('statsRow');
const sessionsBody = document.getElementById('sessionsBody');
const eventsBody = document.getElementById('eventsBody');
const inventorySummary = document.getElementById('inventorySummary');
const inventoryMetrics = document.getElementById('inventoryMetrics');
const inventoryCategories = document.getElementById('inventoryCategories');
const inventorySearch = document.getElementById('inventorySearch');
const refillRequestsBody = document.getElementById('refillRequestsBody');
const scanLogBody = document.getElementById('scanLogBody');
const quantityLogBody = document.getElementById('quantityLogBody');
const filterRefillStatus = document.getElementById('filterRefillStatus');
const filterSessionDevice = document.getElementById('filterSessionDevice');
const filterSessionStatus = document.getElementById('filterSessionStatus');
const filterLoginResult = document.getElementById('filterLoginResult');
const filterLoginDevice = document.getElementById('filterLoginDevice');
const lunchHistoryBody = document.getElementById('lunchHistoryBody');
const punchHistoryBody = document.getElementById('punchHistoryBody');
const detailOverlay = document.getElementById('detailOverlay');
const detailTitle = document.getElementById('detailTitle');
const detailContent = document.getElementById('detailContent');
const detailClose = document.getElementById('detailClose');
const statusBarEl = document.getElementById('statusBar');
const statusBarLabel = document.getElementById('statusBarLabel');
const statusBarFill = document.getElementById('statusBarFill');

let statusBarTimeout = null;

function setStatusBar(message, state) {
  if (!statusBarEl || !statusBarLabel || !statusBarFill) return;
  if (statusBarTimeout) {
    clearTimeout(statusBarTimeout);
    statusBarTimeout = null;
  }
  statusBarEl.classList.remove('status-bar--running', 'status-bar--success', 'status-bar--error');
  statusBarLabel.textContent = message || '';
  if (state === 'idle' || !message) {
    statusBarEl.classList.remove('is-visible');
    return;
  }
  statusBarEl.classList.add('is-visible', 'status-bar--' + state);
  if (state === 'success' || state === 'error') {
    statusBarTimeout = setTimeout(() => {
      setStatusBar('', 'idle');
      statusBarTimeout = null;
    }, 4000);
  }
}

let refreshInterval = null;
let isRefreshing = false;
let cached = { sessions: [], events: [], inventory: [], refillRequests: [], scanLog: [], quantityLog: [], lunches: [], punches: [], stats: null, health: null };

const PAGE_TITLES = { dashboard: 'Dashboard', sessions: 'Sessions', logins: 'Login history', punches: 'Lunch & punches', inventory: 'Inventory', actions: 'Dev actions' };

function parseDevice(ua) {
  if (!ua || typeof ua !== 'string') return { type: 'Desktop', browser: '—', os: '—' };
  const u = ua.toLowerCase();
  const mobile = /mobile|android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|fennec|minimo|symbian|kindle|silk|meego/i.test(u);
  let browser = '—';
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('chrome')) browser = 'Chrome';
  else if (u.includes('firefox')) browser = 'Firefox';
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari';
  else if (u.includes('electron')) browser = 'Desktop app';
  let os = '—';
  if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os') || u.includes('macos')) os = 'macOS';
  else if (u.includes('linux')) os = 'Linux';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  return { type: mobile ? 'Mobile' : 'Desktop', browser, os };
}

function setError(msg) {
  errorBox.textContent = msg || '';
  errorBox.classList.toggle('is-visible', !!msg);
}

function setActionFeedback(msg, el) {
  const target = el || document.getElementById('deploy-desc');
  if (target) target.textContent = msg || '';
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

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : s;
  return div.innerHTML;
}

function openDetail(title, rows) {
  detailTitle.textContent = title;
  detailContent.innerHTML = rows.map(r => `
    <div class="detail-row">
      <div class="detail-row__label">${escapeHtml(r.label)}</div>
      <div class="detail-row__value">${escapeHtml(r.value)}</div>
    </div>
  `).join('');
  detailOverlay.classList.add('is-open');
}

function closeDetail() {
  detailOverlay.classList.remove('is-open');
}

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('is-active'));
  document.querySelectorAll('.sidebar__nav-item').forEach(n => n.classList.remove('is-active'));
  const page = document.getElementById('page-' + pageId);
  const nav = document.querySelector('.sidebar__nav-item[data-page="' + pageId + '"]');
  if (page) page.classList.add('is-active');
  if (nav) nav.classList.add('is-active');
  if (pageTitle) pageTitle.textContent = PAGE_TITLES[pageId] || pageId;
}

function applyTheme(dark) {
  document.body.classList.toggle('theme-dark', !!dark);
  const iconDark = document.getElementById('themeIconDark');
  const iconLight = document.getElementById('themeIconLight');
  const label = document.getElementById('themeLabel');
  if (iconDark) iconDark.style.display = dark ? 'none' : 'block';
  if (iconLight) iconLight.style.display = dark ? 'block' : 'none';
  if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
}

async function loadConfig() {
  const cfg = await api.getConfig();
  applyTheme(!!cfg.darkMode);
  const els = {
    inputApiUrl: document.getElementById('inputApiUrl'),
    inputToken: document.getElementById('inputToken'),
    inputProjectPath: document.getElementById('inputProjectPath'),
    inputServerHost: document.getElementById('inputServerHost'),
    inputServerUser: document.getElementById('inputServerUser'),
    inputServerAppPath: document.getElementById('inputServerAppPath'),
    inputSshKeyPath: document.getElementById('inputSshKeyPath')
  };
  if (els.inputApiUrl) els.inputApiUrl.value = cfg.apiBaseUrl || '';
  if (els.inputToken) els.inputToken.value = cfg.apiToken || '';
  if (els.inputProjectPath) els.inputProjectPath.value = cfg.projectPath || '';
  if (els.inputServerHost) els.inputServerHost.value = cfg.serverHost || '';
  if (els.inputServerUser) els.inputServerUser.value = cfg.serverUser || 'root';
  if (els.inputServerAppPath) els.inputServerAppPath.value = cfg.serverAppPath || '';
  if (els.inputSshKeyPath) els.inputSshKeyPath.value = cfg.sshKeyPath || '';
}

function openSettings() {
  document.getElementById('settingsModal').classList.add('is-open');
  loadConfig();
  document.getElementById('inputApiUrl').focus();
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('is-open');
}

function renderSessions() {
  const deviceFilter = (filterSessionDevice && filterSessionDevice.value) || '';
  const statusFilter = (filterSessionStatus && filterSessionStatus.value) || '';
  let list = [...cached.sessions];
  if (deviceFilter) {
    list = list.filter(s => {
      const d = parseDevice(s.user_agent);
      return d.type === deviceFilter;
    });
  }
  if (statusFilter) {
    if (statusFilter === 'online') list = list.filter(s => s.online);
    else if (statusFilter === 'idle') list = list.filter(s => !s.online);
  }
  if (list.length === 0) {
    sessionsBody.innerHTML = '<p class="table-empty">No sessions match filters.</p>';
    return;
  }
  const byUser = new Map();
  for (const s of list) {
    const key = s.user_id ?? s.username;
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(s);
  }
  sessionsBody.innerHTML = [...byUser.entries()].map(([_, group]) => {
    const first = group[0];
    const name = first.full_name || first.username;
    const anyOnline = group.some(s => s.online);
    const latest = group.reduce((a, s) => {
      const t = s.last_seen_at ? new Date(s.last_seen_at + (String(s.last_seen_at).endsWith('Z') ? '' : 'Z')).getTime() : 0;
      return t > (a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0) ? s : a;
    }, first);
    const dev = parseDevice(latest.user_agent);
    const groupId = 'sg-' + (first.user_id ?? first.username) + '-' + Math.random().toString(36).slice(2, 8);
    const detailRows = group.map(s => {
      const d = parseDevice(s.user_agent);
      return { s, d };
    });
    const rowsHtml = detailRows.map(({ s, d }) => `
      <tr data-session='${escapeHtml(JSON.stringify(s))}'>
        <td><span class="badge badge--${d.type === 'Mobile' ? 'mobile' : 'desktop'}">${escapeHtml(d.type)}</span></td>
        <td>${escapeHtml(d.browser)}</td>
        <td>${escapeHtml(d.os)}</td>
        <td><span class="badge badge--${s.online ? 'online' : 'idle'}">${s.online ? 'Online' : 'Idle'}</span></td>
        <td><code>${escapeHtml(s.ip || '—')}</code></td>
        <td>${timeAgo(s.last_seen_at)}</td>
      </tr>
    `).join('');
    return `
      <div class="user-group">
        <button type="button" class="user-group__header" aria-expanded="false" data-detail-id="${groupId}">
          <span class="user-group__name">${escapeHtml(name)}</span>
          <span class="user-group__meta">@${escapeHtml(first.username)} · ${escapeHtml(first.role || '—')}</span>
          <span class="user-group__summary">
            <span class="badge badge--${dev.type === 'Mobile' ? 'mobile' : 'desktop'}">${escapeHtml(dev.type)}</span>
            <span class="badge badge--${anyOnline ? 'online' : 'idle'}">${anyOnline ? 'Online' : 'Idle'}</span>
            <span>${group.length} session${group.length !== 1 ? 's' : ''}</span>
            <span>${timeAgo(latest.last_seen_at)}</span>
          </span>
        </button>
        <div class="user-group__detail" id="${groupId}">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Device</th><th>Browser</th><th>OS</th><th>Status</th><th>IP</th><th>Last seen</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }).join('');
  sessionsBody.querySelectorAll('.user-group__header').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-detail-id');
      const detail = document.getElementById(id);
      if (detail) {
        const isOpen = detail.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', isOpen);
      }
    });
  });
  sessionsBody.querySelectorAll('[data-session]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        const s = JSON.parse(tr.getAttribute('data-session'));
        const d = parseDevice(s.user_agent);
        openDetail('Session details', [
          { label: 'User', value: (s.full_name || s.username) + ' (@' + (s.username || '') + ')' },
          { label: 'Role', value: s.role || '—' },
          { label: 'Device', value: d.type },
          { label: 'Browser', value: d.browser },
          { label: 'OS', value: d.os },
          { label: 'Status', value: s.online ? 'Online' : 'Idle' },
          { label: 'IP', value: s.ip || '—' },
          { label: 'Started', value: s.started_at ? new Date(s.started_at).toLocaleString() : '—' },
          { label: 'Last seen', value: s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '—' },
          { label: 'User-Agent', value: s.user_agent || '—' }
        ]);
      } catch (_) {}
    });
  });
}

function renderEvents() {
  const resultFilter = (filterLoginResult && filterLoginResult.value) || '';
  const deviceFilter = (filterLoginDevice && filterLoginDevice.value) || '';
  let list = [...cached.events];
  if (resultFilter !== '') list = list.filter(e => Number(e.success) === Number(resultFilter));
  if (deviceFilter) {
    list = list.filter(e => parseDevice(e.user_agent).type === deviceFilter);
  }
  if (list.length === 0) {
    eventsBody.innerHTML = '<tr><td colspan="8" class="table-empty">No login events match filters.</td></tr>';
    return;
  }
  eventsBody.innerHTML = list.map(ev => {
    const d = parseDevice(ev.user_agent);
    const ts = ev.occurred_at ? new Date(ev.occurred_at + (String(ev.occurred_at).endsWith('Z') ? '' : 'Z')).toLocaleString() : '—';
    const isLocal = !ev.ip || ev.ip === '127.0.0.1' || ev.ip === '::1' || String(ev.ip).includes('127.0.0.1');
    const loc = isLocal ? 'Local' : (ev.ip_geo_city ? [ev.ip_geo_city, ev.ip_geo_region, ev.ip_geo_country].filter(Boolean).join(', ') : '—');
    const dataAttr = escapeHtml(JSON.stringify(ev));
    const vpnBadge = ev.is_vpn ? '<span class="badge badge--fail" title="VPN/proxy detected">VPN</span>' : '—';
    return `
      <tr data-event='${dataAttr}' class="detail-row-trigger">
        <td style="color:#6b7280">${escapeHtml(ts)}</td>
        <td>${escapeHtml(ev.full_name || ev.username)}</td>
        <td><span class="badge badge--${ev.success ? 'ok' : 'fail'}">${ev.success ? 'OK' : 'Fail'}</span></td>
        <td><span class="badge badge--${d.type === 'Mobile' ? 'mobile' : 'desktop'}">${escapeHtml(d.type)}</span></td>
        <td><code>${escapeHtml(ev.ip || '—')}</code></td>
        <td>${escapeHtml(loc)}</td>
        <td>${vpnBadge}</td>
        <td>${ev.on_prem_score != null ? ev.on_prem_score + '%' : '—'}</td>
      </tr>
    `;
  }).join('');
  eventsBody.querySelectorAll('[data-event]').forEach(tr => {
    tr.addEventListener('click', () => {
      try {
        const ev = JSON.parse(tr.getAttribute('data-event'));
        const d = parseDevice(ev.user_agent);
        const isLocal = !ev.ip || ev.ip === '127.0.0.1' || ev.ip === '::1' || String(ev.ip).includes('127.0.0.1');
        const loc = isLocal ? 'Local' : ([ev.ip_geo_city, ev.ip_geo_region, ev.ip_geo_country].filter(Boolean).join(', ') || '—');
        openDetail('Login event', [
          { label: 'Time', value: ev.occurred_at ? new Date(ev.occurred_at).toLocaleString() : '—' },
          { label: 'User', value: (ev.full_name || ev.username) + ' (@' + (ev.username || '') + ')' },
          { label: 'Result', value: ev.success ? 'Success' : 'Failed' },
          { label: 'VPN', value: ev.is_vpn ? 'Yes (VPN/proxy detected)' : 'No' },
          { label: 'Device', value: d.type },
          { label: 'Browser', value: d.browser },
          { label: 'OS', value: d.os },
          { label: 'IP', value: ev.ip || '—' },
          { label: 'Location', value: loc },
          { label: 'On-prem score', value: ev.on_prem_score != null ? ev.on_prem_score + '%' : '—' },
          { label: 'User-Agent', value: ev.user_agent || '—' }
        ]);
      } catch (_) {}
    });
  });
}

function formatDateOnly(d) {
  if (!d) return '—';
  const x = new Date(d + (String(d).endsWith('Z') ? '' : 'Z'));
  return isNaN(x.getTime()) ? d : x.toLocaleDateString();
}
function formatDateTime(d) {
  if (!d) return '—';
  const x = new Date(d + (String(d).endsWith('Z') ? '' : 'Z'));
  return isNaN(x.getTime()) ? d : x.toLocaleString();
}
function punchTypeLabel(t) {
  if (t === 'clock_in') return 'Clock In';
  if (t === 'clock_out') return 'Clock Out';
  if (t === 'lunch_out') return 'Lunch out';
  if (t === 'lunch_in') return 'Lunch in';
  return t || '—';
}
function punchTypeClass(t) {
  if (t === 'clock_in') return 'badge--ok';
  if (t === 'clock_out') return 'badge--desktop';
  if (t === 'lunch_out') return 'badge--idle';
  if (t === 'lunch_in') return 'badge--mobile';
  return '';
}

function renderLunches() {
  if (!lunchHistoryBody) return;
  const list = cached.lunches || [];
  if (list.length === 0) {
    lunchHistoryBody.innerHTML = '<tr><td colspan="5" class="table-empty">No lunch records in the last 14 days. Use Refresh to load.</td></tr>';
    return;
  }
  lunchHistoryBody.innerHTML = list.map(l => `
    <tr>
      <td style="color:var(--text-muted)">${escapeHtml(formatDateOnly(l.date))}</td>
      <td>${escapeHtml(l.userName || '—')}</td>
      <td style="color:var(--text-muted)">${escapeHtml(formatDateTime(l.lunchOut))}</td>
      <td style="color:var(--text-muted)">${l.lunchIn ? escapeHtml(formatDateTime(l.lunchIn)) : '—'}</td>
      <td>${l.durationMinutes != null ? escapeHtml(String(l.durationMinutes)) + ' min' : '—'}</td>
    </tr>
  `).join('');
}

function renderPunches() {
  if (!punchHistoryBody) return;
  const list = cached.punches || [];
  if (list.length === 0) {
    punchHistoryBody.innerHTML = '<tr><td colspan="3" class="table-empty">No punch events in the last 14 days. Use Refresh to load.</td></tr>';
    return;
  }
  punchHistoryBody.innerHTML = list.map(p => `
    <tr>
      <td style="color:var(--text-muted)">${escapeHtml(formatDateTime(p.time))}</td>
      <td><span class="badge ${punchTypeClass(p.type)}">${escapeHtml(punchTypeLabel(p.type))}</span></td>
      <td>${escapeHtml(p.userName || '—')}</td>
    </tr>
  `).join('');
}

function renderRefillRequests() {
  if (!refillRequestsBody) return;
  const statusFilter = (filterRefillStatus && filterRefillStatus.value) || '';
  let list = [...cached.refillRequests];
  if (statusFilter) list = list.filter(r => r.status === statusFilter);
  if (list.length === 0) {
    refillRequestsBody.innerHTML = '<tr><td colspan="6" class="table-empty">No reorder requests.</td></tr>';
    return;
  }
  refillRequestsBody.innerHTML = list.map(r => {
    const requestedAt = r.requested_at ? new Date(r.requested_at).toLocaleString() : '—';
    const expected = r.expected_arrival_date ? new Date(r.expected_arrival_date).toLocaleDateString() : '—';
    const statusClass = r.status === 'received' ? 'badge--ok' : r.status === 'pending' ? 'badge--idle' : r.status === 'cancelled' ? 'badge--fail' : 'badge--desktop';
    return `<tr>
      <td>${escapeHtml(r.item_name || '—')}</td>
      <td>${escapeHtml(r.requested_by_name || '—')}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(r.status || '—')}</span></td>
      <td style="color:var(--text-muted)">${escapeHtml(requestedAt)}</td>
      <td>${escapeHtml(r.received_by_name || '—')}</td>
      <td>${escapeHtml(expected)}</td>
    </tr>`;
  }).join('');
}

function renderScanLog() {
  if (!scanLogBody) return;
  const list = cached.scanLog || [];
  if (list.length === 0) {
    scanLogBody.innerHTML = '<tr><td colspan="5" class="table-empty">No scan events yet.</td></tr>';
    return;
  }
  scanLogBody.innerHTML = list.map(s => {
    const time = s.created_at ? new Date(s.created_at).toLocaleString() : '—';
    const eventLabel = s.event_type === 'refill_receive' ? 'Refill received' : 'Scan in';
    return `<tr>
      <td style="color:var(--text-muted)">${escapeHtml(time)}</td>
      <td>${escapeHtml(s.item_name || '—')}</td>
      <td><code>${escapeHtml(s.barcode || '—')}</code></td>
      <td>${escapeHtml(eventLabel)}</td>
      <td>${escapeHtml(s.scanned_by_name || '—')}</td>
    </tr>`;
  }).join('');
}

function renderQuantityLog() {
  if (!quantityLogBody) return;
  const list = cached.quantityLog || [];
  if (list.length === 0) {
    quantityLogBody.innerHTML = '<tr><td colspan="7" class="table-empty">No quantity changes yet.</td></tr>';
    return;
  }
  quantityLogBody.innerHTML = list.map(q => {
    const time = q.created_at ? new Date(q.created_at).toLocaleString() : '—';
    const before = q.quantity_before != null ? Number(q.quantity_before) : '—';
    const after = q.quantity_after != null ? Number(q.quantity_after) : '—';
    const change = typeof before === 'number' && typeof after === 'number' ? (after - before) : '—';
    const unit = q.item_unit || '';
    const changeStr = change === '—' ? '—' : (change >= 0 ? '+' : '') + change + ' ' + unit;
    const reason = (q.reason || '—').replace(/_/g, ' ');
    return `<tr>
      <td style="color:var(--text-muted)">${escapeHtml(time)}</td>
      <td>${escapeHtml(q.item_name || '—')}</td>
      <td>${escapeHtml(String(before))}</td>
      <td>${escapeHtml(String(after))}</td>
      <td>${changeStr}</td>
      <td>${escapeHtml(reason)}</td>
      <td>${escapeHtml(q.changed_by_name || '—')}</td>
    </tr>`;
  }).join('');
}

function renderInventory() {
  const q = (inventorySearch && inventorySearch.value || '').trim().toLowerCase();
  let items = [...cached.inventory];
  if (q) {
    items = items.filter(it =>
      (it.name || '').toLowerCase().includes(q) ||
      (it.category_name || '').toLowerCase().includes(q)
    );
  }
  const lowCount = cached.inventory.filter(it => {
    const min = it.min_quantity != null ? Number(it.min_quantity) : null;
    const qty = it.quantity != null ? Number(it.quantity) : 0;
    return min != null && min > 0 && qty <= min;
  }).length;
  const pendingRefills = (cached.refillRequests || []).filter(r => r.status === 'pending').length;
  if (inventorySummary) {
    if (cached.inventory.length === 0 && !(cached.refillRequests || []).length && !(cached.scanLog || []).length) {
      inventorySummary.textContent = 'No inventory data, or API not available.';
    } else {
      inventorySummary.textContent = `${cached.inventory.length} items · ${lowCount} low stock · ${pendingRefills} pending reorders · ${(cached.scanLog || []).length} scan events.`;
    }
  }
  if (inventoryMetrics) {
    inventoryMetrics.innerHTML = `
      <div class="metric"><div class="metric__value">${cached.inventory.length}</div><div class="metric__label">Items</div></div>
      <div class="metric"><div class="metric__value">${lowCount}</div><div class="metric__label">Low stock</div></div>
      <div class="metric"><div class="metric__value">${(cached.refillRequests || []).length}</div><div class="metric__label">Reorder requests</div></div>
      <div class="metric"><div class="metric__value">${(cached.scanLog || []).length}</div><div class="metric__label">Scan events</div></div>
      <div class="metric"><div class="metric__value">${(cached.quantityLog || []).length}</div><div class="metric__label">Quantity changes</div></div>
    `;
  }
  if (cached.inventory.length === 0) {
    if (inventoryCategories) inventoryCategories.innerHTML = '';
    return;
  }
  const byCat = new Map();
  for (const it of items) {
    const cat = it.category_name || 'Uncategorized';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(it);
  }
  inventoryCategories.innerHTML = [...byCat.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([catName, catItems]) => {
      const rows = catItems.map(it => {
        const qty = it.quantity != null ? Number(it.quantity) : 0;
        const min = it.min_quantity != null ? Number(it.min_quantity) : null;
        const isLow = min != null && min > 0 && qty <= min;
        const unit = it.unit || 'each';
        const dataAttr = escapeHtml(JSON.stringify(it));
        return `<div class="inventory-item" data-item='${dataAttr}'><span class="inventory-item__name">${escapeHtml(it.name || '—')}</span><span class="inventory-item__qty ${isLow ? 'inventory-item__qty--low' : ''}">${qty} ${escapeHtml(unit)}</span></div>`;
      }).join('');
      return `<div class="inventory-cat"><div class="inventory-cat__name">${escapeHtml(catName)}</div><div class="inventory-cat__list">${rows}</div></div>`;
    }).join('');
  inventoryCategories.querySelectorAll('[data-item]').forEach(el => {
    el.addEventListener('click', () => {
      try {
        const it = JSON.parse(el.getAttribute('data-item'));
        openDetail('Inventory item', [
          { label: 'Name', value: it.name || '—' },
          { label: 'Barcode', value: it.barcode || '—' },
          { label: 'Category', value: it.category_name || '—' },
          { label: 'Quantity', value: (it.quantity ?? '—') + ' ' + (it.unit || 'each') },
          { label: 'Min quantity', value: it.min_quantity != null ? it.min_quantity : '—' },
          { label: 'Keep in stock', value: it.keep_in_stock ? 'Yes' : 'No' },
          { label: 'Last counted', value: it.last_counted_at ? new Date(it.last_counted_at).toLocaleString() : '—' }
        ]);
      } catch (_) {}
    });
  });
}

async function refresh() {
  const cfg = await api.getConfig();
  if (!cfg.apiBaseUrl?.trim()) {
    setError('Set API Base URL in Settings.');
    healthBadge.style.display = 'none';
    healthBadgeOk.style.display = 'none';
    lastUpdate.textContent = '';
    cached = { sessions: [], events: [], inventory: [], refillRequests: [], scanLog: [], quantityLog: [], lunches: [], punches: [], stats: null, health: null };
    statsRow.innerHTML = '';
    if (inventoryMetrics) inventoryMetrics.innerHTML = '';
    if (refillRequestsBody) refillRequestsBody.innerHTML = '';
    if (scanLogBody) scanLogBody.innerHTML = '';
    if (quantityLogBody) quantityLogBody.innerHTML = '';
    renderSessions();
    renderEvents();
    renderLunches();
    renderPunches();
    renderInventory();
    renderRefillRequests();
    renderScanLog();
    renderQuantityLog();
    return;
  }
  setError('');
  isRefreshing = true;
  const base = cfg.apiBaseUrl.replace(/\/+$/, '');
  const token = cfg.apiToken?.trim() || '';
  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - 14);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];
  try {
    const [health, stats, sessionsRes, eventsRes, inventoryRes, refillRes, scanLogRes, quantityLogRes, lunchRes, punchRes] = await Promise.all([
      api.fetch(base + '/health', token).catch(() => null),
      api.fetch(base + '/admin/security/stats', token).catch(() => null),
      api.fetch(base + '/admin/security/active-sessions', token).catch(() => null),
      api.fetch(base + '/admin/security/login-events?limit=100', token).catch(() => null),
      api.fetch(base + '/inventory/items', token).catch(() => null),
      api.fetch(base + '/inventory/refill-requests', token).catch(() => null),
      api.fetch(base + '/inventory/scan-log?limit=200', token).catch(() => null),
      api.fetch(base + '/inventory/quantity-log?limit=200', token).catch(() => null),
      api.fetch(base + '/time/lunch-history?from=' + encodeURIComponent(fromStr) + '&to=' + encodeURIComponent(toStr), token).catch(() => ({ lunches: [] })),
      api.fetch(base + '/time/punch-history?from=' + encodeURIComponent(fromStr) + 'T00:00:00.000Z&to=' + encodeURIComponent(toStr) + 'T23:59:59.999Z', token).catch(() => ({ punches: [] }))
    ]);
    cached.health = health;
    cached.stats = stats;
    cached.sessions = sessionsRes?.sessions || [];
    cached.events = eventsRes?.events || [];
    cached.inventory = inventoryRes?.items || [];
    cached.refillRequests = refillRes?.requests || [];
    cached.scanLog = scanLogRes?.entries || [];
    cached.quantityLog = quantityLogRes?.entries || [];
    cached.lunches = lunchRes?.lunches || [];
    cached.punches = punchRes?.punches || [];
    if (health?.status === 'ok') {
      healthBadge.style.display = 'none';
      healthBadgeOk.style.display = 'inline';
    } else {
      healthBadgeOk.style.display = 'none';
      healthBadge.style.display = 'inline';
    }
    if (stats) {
      statsRow.innerHTML = `
        <div class="metric"><div class="metric__value">${stats.activeSessions ?? 0}</div><div class="metric__label">Active sessions</div></div>
        <div class="metric"><div class="metric__value">${stats.loginsToday ?? 0}</div><div class="metric__label">Logins today</div></div>
        <div class="metric"><div class="metric__value">${stats.failedLast24h ?? 0}</div><div class="metric__label">Failed (24h)</div></div>
        <div class="metric"><div class="metric__value">${stats.uniqueIPsToday ?? 0}</div><div class="metric__label">Unique IPs today</div></div>
      `;
    } else {
      statsRow.innerHTML = '<div class="metric"><div class="metric__value">—</div><div class="metric__label">No data</div></div>';
    }
    renderSessions();
    renderEvents();
    renderLunches();
    renderPunches();
    renderInventory();
    renderRefillRequests();
    renderScanLog();
    renderQuantityLog();
    lastUpdate.textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (err) {
    setError('Error: ' + (err?.message || err));
    healthBadgeOk.style.display = 'none';
    healthBadge.style.display = 'inline';
    lastUpdate.textContent = '';
    cached = { sessions: [], events: [], inventory: [], refillRequests: [], scanLog: [], quantityLog: [], lunches: [], punches: [], stats: null, health: null };
    renderSessions();
    renderEvents();
    renderLunches();
    renderPunches();
    renderInventory();
    renderRefillRequests();
    renderScanLog();
    renderQuantityLog();
  } finally {
    isRefreshing = false;
  }
}

document.querySelectorAll('.sidebar__nav-item[data-page]').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
});
document.getElementById('btnSettingsNav').addEventListener('click', openSettings);
document.getElementById('btnRefresh').addEventListener('click', () => { if (!isRefreshing) refresh(); });

document.getElementById('themeToggle').addEventListener('click', async () => {
  const cfg = await api.getConfig();
  const next = !cfg.darkMode;
  await api.setConfig({ darkMode: next });
  applyTheme(next);
});
detailClose.addEventListener('click', closeDetail);
detailOverlay.addEventListener('click', (e) => { if (e.target === detailOverlay) closeDetail(); });

document.getElementById('btnSettingsClose').addEventListener('click', closeSettings);
document.getElementById('settingsModal').addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
document.getElementById('settingsModal').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });

document.getElementById('btnSaveConfig').addEventListener('click', async () => {
  const cfg = {
    apiBaseUrl: document.getElementById('inputApiUrl').value.trim(),
    apiToken: document.getElementById('inputToken').value.trim(),
    projectPath: document.getElementById('inputProjectPath').value.trim() || '',
    serverHost: document.getElementById('inputServerHost').value.trim() || '',
    serverUser: document.getElementById('inputServerUser').value.trim() || 'root',
    serverAppPath: document.getElementById('inputServerAppPath').value.trim() || '',
    sshKeyPath: document.getElementById('inputSshKeyPath').value.trim() || ''
  };
  await api.setConfig(cfg);
  closeSettings();
  refresh();
});

function wireDeployButtons() {
  const runDeploy = async (feedbackEl) => {
    setStatusBar('Opening deploy terminal…', 'running');
    setActionFeedback('Starting deploy…', feedbackEl);
    try {
      await api.runNpmDeploy();
      setStatusBar('Deploy terminal opened.', 'success');
      setActionFeedback('Deploy window opened. Check terminal for progress.', feedbackEl);
    } catch (err) {
      setStatusBar('Failed: ' + (err?.message || err), 'error');
      setActionFeedback('Failed: ' + (err?.message || err), feedbackEl);
      setError('Deploy failed: ' + (err?.message || err));
    }
  };
  const runCursor = async (feedbackEl) => {
    setStatusBar('Opening Cursor…', 'running');
    setActionFeedback('', feedbackEl);
    try {
      await api.openCursor();
      setStatusBar('Cursor opened.', 'success');
      setActionFeedback('Cursor opened.', feedbackEl);
    } catch (err) {
      setStatusBar('Failed: ' + (err?.message || err), 'error');
      setActionFeedback('Failed: ' + (err?.message || err), feedbackEl);
      setError(err?.message || err);
    }
  };
  const runSsh = async (feedbackEl) => {
    setStatusBar('Opening SSH terminal…', 'running');
    setActionFeedback('', feedbackEl);
    try {
      await api.openSsh();
      setStatusBar('SSH terminal opened.', 'success');
      setActionFeedback('SSH terminal opened.', feedbackEl);
    } catch (err) {
      setStatusBar('Failed: ' + (err?.message || err), 'error');
      setActionFeedback('Failed: ' + (err?.message || err), feedbackEl);
      setError(err?.message || err);
    }
  };
  const runPush = async (feedbackEl) => {
    setStatusBar('Deploying to server (git push + SSH)…', 'running');
    setActionFeedback('Pushing…', feedbackEl);
    const btn = document.getElementById('btnPushViaGit') || document.getElementById('btnPushViaGit2');
    if (btn) btn.disabled = true;
    try {
      await api.deployToServer();
      setStatusBar('Deploy completed.', 'success');
      setActionFeedback('Deploy completed.', feedbackEl);
      setError('');
    } catch (err) {
      setStatusBar('Failed: ' + (err?.message || err), 'error');
      setActionFeedback('Failed: ' + (err?.message || err), feedbackEl);
      setError(err?.message || err);
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  const runDeployBackendOnly = async (feedbackEl) => {
    setStatusBar('Deploying backend only…', 'running');
    setActionFeedback('Deploying backend only…', feedbackEl);
    setError('');
    const btn = document.getElementById('btnDeployBackend') || document.getElementById('btnDeployBackend2');
    if (btn) btn.disabled = true;
    try {
      await api.deployBackendOnly();
      setStatusBar('Backend deploy done.', 'success');
      setActionFeedback('Backend deploy done.', feedbackEl);
    } catch (err) {
      setStatusBar('Failed: ' + (err?.message || err), 'error');
      setActionFeedback('Failed: ' + (err?.message || err), feedbackEl);
      setError(err?.message || err);
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  const runDeployFrontendOnly = async (feedbackEl) => {
    setStatusBar('Deploying frontend only…', 'running');
    setActionFeedback('Deploying frontend only…', feedbackEl);
    setError('');
    const btn = document.getElementById('btnDeployFrontend') || document.getElementById('btnDeployFrontend2');
    if (btn) btn.disabled = true;
    try {
      await api.deployFrontendOnly();
      setStatusBar('Frontend deploy done.', 'success');
      setActionFeedback('Frontend deploy done.', feedbackEl);
    } catch (err) {
      setStatusBar('Failed: ' + (err?.message || err), 'error');
      setActionFeedback('Failed: ' + (err?.message || err), feedbackEl);
      setError(err?.message || err);
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  const runDeployFullForce = async (feedbackEl) => {
    setStatusBar('Full deploy (force upload)…', 'running');
    setActionFeedback('Full deploy (force upload)…', feedbackEl);
    setError('');
    const btn = document.getElementById('btnDeployFullForce') || document.getElementById('btnDeployFullForce2');
    if (btn) btn.disabled = true;
    try {
      await api.deployFullForce();
      setStatusBar('Full deploy done.', 'success');
      setActionFeedback('Full deploy done.', feedbackEl);
    } catch (err) {
      setStatusBar('Failed: ' + (err?.message || err), 'error');
      setActionFeedback('Failed: ' + (err?.message || err), feedbackEl);
      setError(err?.message || err);
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  const feedback = document.getElementById('deploy-desc');
  const feedback2 = document.getElementById('deploy-desc2');
  if (document.getElementById('btnDeploy')) document.getElementById('btnDeploy').addEventListener('click', () => runDeploy(feedback));
  if (document.getElementById('btnDeploy2')) document.getElementById('btnDeploy2').addEventListener('click', () => runDeploy(feedback2));
  if (document.getElementById('btnDeployBackend')) document.getElementById('btnDeployBackend').addEventListener('click', () => runDeployBackendOnly(feedback));
  if (document.getElementById('btnDeployBackend2')) document.getElementById('btnDeployBackend2').addEventListener('click', () => runDeployBackendOnly(feedback2));
  if (document.getElementById('btnDeployFrontend')) document.getElementById('btnDeployFrontend').addEventListener('click', () => runDeployFrontendOnly(feedback));
  if (document.getElementById('btnDeployFrontend2')) document.getElementById('btnDeployFrontend2').addEventListener('click', () => runDeployFrontendOnly(feedback2));
  if (document.getElementById('btnDeployFullForce')) document.getElementById('btnDeployFullForce').addEventListener('click', () => runDeployFullForce(feedback));
  if (document.getElementById('btnDeployFullForce2')) document.getElementById('btnDeployFullForce2').addEventListener('click', () => runDeployFullForce(feedback2));
  if (document.getElementById('btnOpenCursor')) document.getElementById('btnOpenCursor').addEventListener('click', () => runCursor(feedback));
  if (document.getElementById('btnOpenCursor2')) document.getElementById('btnOpenCursor2').addEventListener('click', () => runCursor(feedback2));
  if (document.getElementById('btnOpenSsh')) document.getElementById('btnOpenSsh').addEventListener('click', () => runSsh(feedback));
  if (document.getElementById('btnOpenSsh2')) document.getElementById('btnOpenSsh2').addEventListener('click', () => runSsh(feedback2));
  if (document.getElementById('btnPushViaGit')) document.getElementById('btnPushViaGit').addEventListener('click', () => runPush(feedback));
  if (document.getElementById('btnPushViaGit2')) document.getElementById('btnPushViaGit2').addEventListener('click', () => runPush(feedback2));
}

document.getElementById('btnBrowseProject').addEventListener('click', async () => {
  const path = await api.pickFolder();
  if (path) document.getElementById('inputProjectPath').value = path;
});
document.getElementById('btnBrowseSshKey').addEventListener('click', async () => {
  const path = await api.pickFile();
  if (path) document.getElementById('inputSshKeyPath').value = path;
});

filterSessionDevice && filterSessionDevice.addEventListener('change', renderSessions);
filterSessionStatus && filterSessionStatus.addEventListener('change', renderSessions);
filterLoginResult && filterLoginResult.addEventListener('change', renderEvents);
filterLoginDevice && filterLoginDevice.addEventListener('change', renderEvents);
inventorySearch && inventorySearch.addEventListener('input', () => { if (cached.inventory.length) renderInventory(); });
filterRefillStatus && filterRefillStatus.addEventListener('change', renderRefillRequests);

wireDeployButtons();

(async () => {
  await loadConfig();
  await refresh();
  refreshInterval = setInterval(refresh, 20000);
})();

window.addEventListener('beforeunload', () => { if (refreshInterval) clearInterval(refreshInterval); });

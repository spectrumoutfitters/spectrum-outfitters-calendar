/**
 * Pure display rules for the server monitor inventory and session tables.
 * Loaded as a classic script in the Electron renderer and as CJS from tests.
 */

function isMonitorLowStock(item) {
  const min = item?.min_quantity != null ? Number(item.min_quantity) : null;
  const qty = item?.quantity != null ? Number(item.quantity) : 0;
  return min != null && min > 0 && qty <= min;
}

function formatQuantityChange(beforeRaw, afterRaw, unit) {
  const before = beforeRaw != null ? Number(beforeRaw) : '—';
  const after = afterRaw != null ? Number(afterRaw) : '—';
  const change = typeof before === 'number' && typeof after === 'number' ? (after - before) : '—';
  const unitStr = unit || '';
  if (change === '—') return '—';
  return (change >= 0 ? '+' : '') + change + ' ' + unitStr;
}

function parseMonitorDevice(ua) {
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

const api = { isMonitorLowStock, formatQuantityChange, parseMonitorDevice };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.monitorDisplay = api;
}

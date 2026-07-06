import { ADMIN_MAIN_TABS_ADMIN, ADMIN_SUB_TABS } from '../../config/adminNavRegistry.js';

export const JUMP_RECENT_KEY = 'jump_palette_recent_v1';
export const MAX_RECENT = 8;

/** Extra tokens for fuzzy matching (beyond title + breadcrumb). */
const ADMIN_EXTRA_KW = {
  overview: ['dashboard', 'home', 'summary', 'invoice link', 'short link'],
  grand_opening: ['opening', 'event', 'raffle'],
  'people.status': ['employees', 'clocked', 'presence'],
  'people.schedule': ['calendar', 'shifts'],
  'people.time': ['approve', 'timesheet', 'entries'],
  'people.users': ['roles', 'accounts', 'payroll access'],
  'people.worklist': ['tasks', 'today'],
  'people.history': ['audit', 'activity'],
  'inventory.inventory': ['parts', 'stock', 'shop'],
  'inventory.orders': ['purchase'],
  'inventory.products': ['sku', 'catalog'],
  'finance.payroll': ['wages', 'salary'],
  'finance.paystub_maker': ['paystub', 'pay stub', 'pdf', '1099', 'w2', 'earning'],
  'finance.shop_financing': ['loan', 'employee financing'],
  'finance.finance': ['pl', 'p&l', 'profit', 'loss', 'cash'],
  'finance.analytics': ['charts', 'metrics'],
  'finance.reports': ['export', 'csv'],
  'finance.compliance': ['tax', 'deadline', 'irs'],
  'settings.general': ['preferences'],
  'settings.customer_booking': ['booking', 'customer portal'],
  'settings.security': ['sessions', 'login', 'password'],
  'settings.updates': ['changelog'],
};

/** @typedef {{ id: string; title: string; subtitle: string; keywords: string[]; run: () => void }} JumpCommand */

export function norm(s) {
  return `${s || ''}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
}

export function matchesQuery(query, haystack) {
  const q = norm(query).trim();
  if (!q) return true;
  const h = norm(haystack);
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => h.includes(tok));
}

/** Match typed characters in order (helps fat-finger / abbreviations). */
export function subsequenceMatch(query, haystack) {
  const q = norm(query).replace(/\s+/g, '');
  const h = norm(haystack).replace(/\s+/g, '');
  if (!q.length) return true;
  let i = 0;
  for (let j = 0; j < h.length; j += 1) {
    if (h[j] === q[i]) i += 1;
    if (i >= q.length) return true;
  }
  return i >= q.length;
}

export function loadRecentIds() {
  try {
    const raw = localStorage.getItem(JUMP_RECENT_KEY);
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => typeof x === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentId(id) {
  const prev = loadRecentIds().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(JUMP_RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** @param {HTMLElement | null} root */
export function getFocusableElements(root) {
  if (!root) return [];
  const sel = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  const nodes = Array.from(root.querySelectorAll(sel));
  return nodes.filter((node) => {
    if (!(node instanceof HTMLElement)) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    if (node instanceof HTMLInputElement && node.type === 'hidden') return false;
    return true;
  });
}

/**
 * @param {string} query
 * @param {JumpCommand} cmd
 */
export function scoreCommand(query, cmd) {
  const q = norm(query).trim();
  const hay = `${cmd.title} ${cmd.subtitle} ${cmd.keywords.join(' ')}`;
  const titleN = norm(cmd.title);
  if (!q) return 1;
  if (matchesQuery(query, hay)) {
    const qCompact = q.replace(/\s+/g, '');
    const titleCompact = titleN.replace(/\s+/g, '');
    const tokens = q.split(/\s+/).filter(Boolean);
    if (titleCompact.startsWith(qCompact)) return 120;
    if (tokens.every((tok) => titleN.includes(tok))) return 110;
    if (matchesQuery(query, cmd.title)) return 95;
    return 75;
  }
  if (subsequenceMatch(query, hay)) return 28;
  return 0;
}

export function buildAdminCommands(navigate) {
  /** @type {JumpCommand[]} */
  const cmds = [];

  ADMIN_MAIN_TABS_ADMIN.forEach((main) => {
    const subs = ADMIN_SUB_TABS[main.id];
    if (!subs) {
      cmds.push({
        id: `admin:${main.id}`,
        title: main.label,
        subtitle: 'Admin',
        keywords: ADMIN_EXTRA_KW[main.id] || [],
        run: () => {
          const p = new URLSearchParams();
          p.set('adm', main.id);
          navigate({ pathname: '/admin', search: `?${p.toString()}` });
        },
      });
      return;
    }
    subs.forEach((sub) => {
      const kwKey = `${main.id}.${sub.id}`;
      cmds.push({
        id: `admin:${main.id}:${sub.id}`,
        title: sub.label,
        subtitle: `${main.label} · Admin`,
        keywords: ADMIN_EXTRA_KW[kwKey] || [],
        run: () => {
          const p = new URLSearchParams();
          p.set('adm', main.id);
          p.set('adsub', sub.id);
          navigate({ pathname: '/admin', search: `?${p.toString()}` });
        },
      });
    });
  });

  /** Cross-app shortcuts (admins only palette). */
  const routes = [
    { path: '/dashboard', title: 'Dashboard', subtitle: 'App', keywords: ['home'] },
    { path: '/dispatch', title: 'Dispatch board', subtitle: 'App', keywords: ['jobs', 'shop floor'] },
    { path: '/tasks', title: 'Tasks', subtitle: 'App', keywords: ['todo', 'review'] },
    { path: '/time', title: 'Time clock', subtitle: 'App', keywords: ['punch', 'hours'] },
    { path: '/schedule', title: 'Schedule', subtitle: 'App', keywords: ['calendar'] },
    { path: '/inventory', title: 'Inventory', subtitle: 'App', keywords: ['parts'] },
    { path: '/products', title: 'Products', subtitle: 'App', keywords: ['catalog'] },
    { path: '/crm', title: 'Customers (CRM)', subtitle: 'App', keywords: ['clients', 'invoices'] },
    {
      path: '/crm/quick-jobs',
      title: 'Quick jobs',
      subtitle: 'CRM · Admin',
      keywords: ['bolt-on', 'addons'],
    },
    { path: '/profile', title: 'Profile', subtitle: 'App', keywords: ['account', 'me'] },
  ];

  routes.forEach((r) => {
    cmds.push({
      id: `route:${r.path}`,
      title: r.title,
      subtitle: r.subtitle,
      keywords: r.keywords,
      run: () => navigate(r.path),
    });
  });

  return cmds;
}

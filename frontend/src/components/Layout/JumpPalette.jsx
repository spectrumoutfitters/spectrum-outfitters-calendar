import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_MAIN_TABS_ADMIN, ADMIN_SUB_TABS } from '../../config/adminNavRegistry';

const JumpPaletteContext = createContext(null);

/** @returns {{ openPalette: () => void }} */
export function useJumpPalette() {
  const ctx = useContext(JumpPaletteContext);
  if (!ctx) throw new Error('useJumpPalette must be used inside JumpPaletteProvider');
  return ctx;
}

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

function norm(s) {
  return `${s || ''}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
}

function matchesQuery(query, haystack) {
  const q = norm(query).trim();
  if (!q) return true;
  const h = norm(haystack);
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => h.includes(tok));
}

function buildAdminCommands(navigate) {
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

export function JumpPaletteProvider({ children }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);

  const commands = useMemo(() => buildAdminCommands(navigate), [navigate]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = commands.filter((c) =>
      matchesQuery(q, `${c.title} ${c.subtitle} ${c.keywords.join(' ')}`),
    );
    return list.slice(0, 48);
  }, [commands, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin]);

  useEffect(() => {
    if (!open || !isAdmin) return undefined;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, isAdmin]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const openPalette = useCallback(() => {
    if (!isAdmin) return;
    setOpen(true);
  }, [isAdmin]);

  const ctxValue = useMemo(() => ({ openPalette, closePalette }), [openPalette, closePalette]);

  const runHighlighted = useCallback(() => {
    const cmd = filtered[highlight];
    if (!cmd) return;
    cmd.run();
    closePalette();
  }, [filtered, highlight, closePalette]);

  useEffect(() => {
    if (!open || !isAdmin) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((i) =>
          filtered.length === 0 ? 0 : Math.min(filtered.length - 1, i + 1),
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((i) => (filtered.length === 0 ? 0 : Math.max(0, i - 1)));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        runHighlighted();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isAdmin, filtered.length, closePalette, runHighlighted]);

  return (
    <JumpPaletteContext.Provider value={ctxValue}>
      {children}
      {open && isAdmin && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-black/55 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePalette();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="jump-palette-title"
            className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <p id="jump-palette-title" className="sr-only">
                Jump to page or admin section
              </p>
              <input
                ref={inputRef}
                type="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="Jump to… (admin sections, payroll, CRM…)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 outline-none ring-primary/30 placeholder:text-neutral-400 focus:border-primary focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
              <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1 py-px font-mono text-[10px] dark:border-neutral-600 dark:bg-neutral-800">
                  ⌘K
                </kbd>{' '}
                /{' '}
                <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1 py-px font-mono text-[10px] dark:border-neutral-600 dark:bg-neutral-800">
                  Ctrl K
                </kbd>{' '}
                anywhere · arrows · enter
              </p>
            </div>
            <ul className="max-h-[min(52vh,420px)] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  No matches. Try “pay stub”, “compliance”, “CRM”, …
                </li>
              ) : (
                filtered.map((cmd, idx) => {
                  const active = idx === highlight;
                  return (
                    <li key={cmd.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => {
                          cmd.run();
                          closePalette();
                        }}
                        className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left text-sm transition-colors ${
                          active
                            ? 'bg-primary/15 text-neutral-900 dark:bg-primary/25 dark:text-neutral-50'
                            : 'text-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800/80'
                        }`}
                      >
                        <span className="font-medium">{cmd.title}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">{cmd.subtitle}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </JumpPaletteContext.Provider>
  );
}

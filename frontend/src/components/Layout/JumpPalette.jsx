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
import {
  buildAdminCommands,
  loadRecentIds,
  pushRecentId,
  rankCommands,
} from './jumpPaletteUtils.js';

const JumpPaletteContext = createContext(null);

/** @returns {{ openPalette: () => void }} */
export function useJumpPalette() {
  const ctx = useContext(JumpPaletteContext);
  if (!ctx) throw new Error('useJumpPalette must be used inside JumpPaletteProvider');
  return ctx;
}

/** @param {HTMLElement | null} root */
function getFocusableElements(root) {
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

export function JumpPaletteProvider({ children }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [recentIds, setRecentIds] = useState(loadRecentIds);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  /** Element that had focus before the palette opened (restored on close). */
  const lastFocusElRef = useRef(/** @type {HTMLElement | null} */ (null));
  const openRef = useRef(false);

  const commands = useMemo(() => buildAdminCommands(navigate), [navigate]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) setRecentIds(loadRecentIds());
  }, [open]);

  const ranked = useMemo(
    () => rankCommands(commands, query, recentIds),
    [commands, query, recentIds],
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

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
    const ae = document.activeElement;
    lastFocusElRef.current = ae instanceof HTMLElement ? ae : null;
    setOpen(true);
  }, [isAdmin]);

  /** Restore keyboard focus to the control that opened the palette. */
  useEffect(() => {
    if (open) return undefined;
    const el = lastFocusElRef.current;
    lastFocusElRef.current = null;
    if (!el) return undefined;
    const id = window.requestAnimationFrame(() => {
      try {
        if (document.contains(el)) el.focus();
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (openRef.current) {
          closePalette();
        } else {
          const ae = document.activeElement;
          lastFocusElRef.current = ae instanceof HTMLElement ? ae : null;
          setOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin, closePalette]);

  /** Keep Tab / Shift+Tab cycling inside the dialog while it is open. */
  useEffect(() => {
    if (!open || !isAdmin) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = getFocusableElements(root);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, isAdmin]);

  const ctxValue = useMemo(() => ({ openPalette, closePalette }), [openPalette, closePalette]);

  const runCommand = useCallback(
    (cmd) => {
      pushRecentId(cmd.id);
      setRecentIds(loadRecentIds());
      cmd.run();
      closePalette();
    },
    [closePalette],
  );

  const runHighlighted = useCallback(() => {
    const row = ranked[highlight];
    if (!row) return;
    runCommand(row.cmd);
  }, [ranked, highlight, runCommand]);

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
          ranked.length === 0 ? 0 : Math.min(ranked.length - 1, i + 1),
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((i) => (ranked.length === 0 ? 0 : Math.max(0, i - 1)));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        runHighlighted();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isAdmin, ranked.length, closePalette, runHighlighted]);

  const showRecentHeading =
    !query.trim() && recentIds.length > 0 && ranked.some((r) => r.isRecent);

  return (
    <JumpPaletteContext.Provider value={ctxValue}>
      {children}
      {open && isAdmin && (
        <div
          className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/60 backdrop-blur-[2px] sm:items-start sm:justify-center sm:p-4 sm:pb-[12vh]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePalette();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search and jump to a destination"
            className="flex max-h-[min(92dvh,640px)] w-full flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 sm:mx-auto sm:max-h-[min(85vh,520px)] sm:max-w-xl sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <p className="text-base font-semibold text-neutral-900 dark:text-neutral-50">Search</p>
              <button
                type="button"
                onClick={closePalette}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-50 px-4 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 sm:min-h-[36px] sm:px-3 sm:py-2"
                aria-label="Close search"
              >
                Close
              </button>
            </div>
            <div className="shrink-0 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <label htmlFor="jump-palette-input" className="sr-only">
                Search destinations
              </label>
              <input
                id="jump-palette-input"
                ref={inputRef}
                type="search"
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Type to find payroll, CRM, pay stub…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-900 outline-none ring-primary/30 placeholder:text-neutral-400 focus:border-primary focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 sm:text-sm"
              />
              <p className="mt-2 hidden text-[11px] text-neutral-500 dark:text-neutral-400 sm:block">
                <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1 py-px font-mono text-[10px] dark:border-neutral-600 dark:bg-neutral-800">
                  ⌘K
                </kbd>{' '}
                /{' '}
                <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1 py-px font-mono text-[10px] dark:border-neutral-600 dark:bg-neutral-800">
                  Ctrl K
                </kbd>{' '}
                · arrows · Enter · Esc
              </p>
              <p className="mt-2 text-[12px] text-neutral-500 dark:text-neutral-400 sm:hidden">
                Tap a result below · swipe the list
              </p>
            </div>
            <ul className="list-none min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {ranked.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  No matches. Try “pay stub”, “compliance”, “CRM”, or fewer letters.
                </li>
              ) : (
                ranked.map((row, idx) => {
                  const { cmd } = row;
                  const active = idx === highlight;
                  const showRecentLabel =
                    showRecentHeading && idx === 0 && row.isRecent;
                  const showAllDestinationsLabel =
                    idx > 0 && ranked[idx - 1].isRecent && !row.isRecent;

                  return (
                    <React.Fragment key={cmd.id}>
                      {showRecentLabel ? (
                        <li className="pointer-events-none list-none px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                          Recent
                        </li>
                      ) : null}
                      {showAllDestinationsLabel ? (
                        <li className="pointer-events-none list-none px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                          All destinations
                        </li>
                      ) : null}
                      <li className="list-none">
                        <button
                          type="button"
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => runCommand(cmd)}
                          className={`flex min-h-[48px] w-full flex-col justify-center gap-0.5 px-4 py-3 text-left text-sm transition-colors sm:min-h-0 sm:py-2.5 ${
                            active
                              ? 'bg-primary/15 text-neutral-900 dark:bg-primary/25 dark:text-neutral-50'
                              : 'text-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800/80'
                          }`}
                        >
                          <span className="font-medium">{cmd.title}</span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">{cmd.subtitle}</span>
                        </button>
                      </li>
                    </React.Fragment>
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

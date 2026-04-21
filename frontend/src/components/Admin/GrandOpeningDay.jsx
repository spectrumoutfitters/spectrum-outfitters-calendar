'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const GOLD = '#D4A017';

const LS_INFRA = 'so_raffle_infra_collapsed';

const raffleOrigin = (import.meta.env.VITE_RAFFLE_ORIGIN || 'https://raffle.spectrumoutfitters.com').replace(
  /\/$/,
  '',
);

const EXAMPLE_BONUS_JSON = `[{"id":"instagram","label":"Follow on Instagram","description":"Tag us in a story","tickets":2},{"id":"review","label":"Google review","tickets":5},{"id":"tiktok","label":"TikTok duet","tickets":3}]`;

/**
 * Staff: live raffle iframe + optional setup (hidden after connection unless you expand or start a new giveaway).
 */
const GrandOpeningDay = () => {
  const { isAdmin } = useAuth();
  const adminUrl = `${raffleOrigin}/admin/grand-opening`;
  const publicEntryUrl = `${raffleOrigin}/e/grand-opening`;
  const checkUrl = `${raffleOrigin}/api/event/grand-opening`;

  const [live, setLive] = useState(null);
  const [checking, setChecking] = useState(true);
  const [infraOpen, setInfraOpen] = useState(() => typeof window !== 'undefined' && localStorage.getItem(LS_INFRA) !== '1');
  const [giveawayHelpOpen, setGiveawayHelpOpen] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(checkUrl, { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data?.ok === true && data?.event;
      setLive(ok);
      if (typeof window !== 'undefined') {
        if (ok) {
          localStorage.setItem(LS_INFRA, '1');
          setInfraOpen(false);
        } else {
          setInfraOpen(true);
        }
      }
    } catch {
      setLive(false);
    } finally {
      setChecking(false);
    }
  }, [checkUrl]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const collapseInfra = () => {
    localStorage.setItem(LS_INFRA, '1');
    setInfraOpen(false);
  };

  const newGiveaway = () => {
    localStorage.removeItem(LS_INFRA);
    setInfraOpen(true);
    setGiveawayHelpOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">Grand Opening Day · Raffle</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400 max-w-3xl">
              Live stats and draws run in the panel below. Enter the raffle admin key inside that panel (saved in this
              browser only for the raffle site).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {checking ? (
              <span className="text-xs text-neutral-500">Checking connection…</span>
            ) : live ? (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                Connected
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200">
                Needs setup
              </span>
            )}
            <button
              type="button"
              onClick={() => void runCheck()}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Recheck
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a
            href={publicEntryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-amber-600/50 hover:decoration-amber-500"
            style={{ color: GOLD }}
          >
            Open public entry page
          </a>
          <span className="text-gray-400 dark:text-neutral-600">·</span>
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 underline"
          >
            Open dashboard in new tab
          </a>
        </div>
      </div>

      {isAdmin && !infraOpen && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/50 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-sm text-emerald-950 dark:text-emerald-100">
            {live ? 'Raffle is connected. Technical setup is hidden.' : 'Finish one-time server setup, then this banner stays minimal.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setInfraOpen(true)}
              className="rounded-lg border border-emerald-700/30 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50 dark:border-emerald-700/50 dark:bg-neutral-900 dark:text-emerald-100 dark:hover:bg-neutral-800"
            >
              Show server setup
            </button>
            <button
              type="button"
              onClick={newGiveaway}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
              style={{ background: GOLD }}
            >
              New giveaway (sheet + bonuses)
            </button>
          </div>
        </div>
      )}

      {isAdmin && infraOpen && (
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">One-time server setup</h3>
            <button
              type="button"
              onClick={collapseInfra}
              className="text-xs font-medium text-amber-900/80 underline dark:text-amber-200/90"
            >
              Hide when done
            </button>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-amber-950/90 dark:text-amber-100/90">
            <li>
              In GitHub → <strong>Settings → Secrets → Actions</strong>, add{' '}
              <code className="rounded bg-black/10 dark:bg-black/30 px-1">RAFFLE_APPS_SCRIPT_URL</code> with your Apps
              Script web app URL, then push <code className="rounded bg-black/10 dark:bg-black/30 px-1">main</code> (or
              re-run deploy).
            </li>
            <li>
              Or on the droplet create <code className="rounded bg-black/10 dark:bg-black/30 px-1">/etc/spectrum-raffle.env</code>{' '}
              with <code className="rounded bg-black/10 dark:bg-black/30 px-1">APPS_SCRIPT_URL=…</code> and{' '}
              <code className="rounded bg-black/10 dark:bg-black/30 px-1">NODE_ENV=production</code>, then redeploy or{' '}
              <code className="rounded bg-black/10 dark:bg-black/30 px-1">pm2 restart spectrum-raffle</code>.
            </li>
            <li>DNS / SSL: <code className="rounded bg-black/10 dark:bg-black/30 px-1">raffle</code> A record → droplet; certbot for HTTPS.</li>
          </ol>
          <p className="text-xs text-amber-900/70 dark:text-amber-200/70">
            Full reference: <code className="rounded bg-black/10 dark:bg-black/30 px-1">raffle-platform/scripts/SETUP_SERVER.md</code>
          </p>
        </div>
      )}

      {isAdmin && giveawayHelpOpen && (
        <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Giveaway content (Google Sheet)</h3>
            <button
              type="button"
              onClick={() => setGiveawayHelpOpen(false)}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Close
            </button>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-neutral-300">
            <li>
              <strong>Prize pools (what people enter for):</strong> use the <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">Raffles</code> tab — one row per pool (columns <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">slug</code>,{' '}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">raffleId</code>, <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">title</code>, etc.). They show up as cards on the public entry page.
            </li>
            <li>
              <strong>Ways to earn extra tickets:</strong> on the <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">Events</code> row for your slug, add column{' '}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">bonusRulesJson</code> (paste a single-line JSON array). Example:
            </li>
          </ul>
          <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-3 text-xs text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
            {EXAMPLE_BONUS_JSON}
          </pre>
          <p className="text-xs text-neutral-500">
            Each object needs <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">id</code> (stable key),{' '}
            <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">label</code>, optional <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">description</code>, and{' '}
            <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">tickets</code> (extra tickets if checked). Redeploy Apps Script after editing the sheet column.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden bg-neutral-900">
        <div className="px-3 py-2 border-b border-neutral-700 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-neutral-400">Live dashboard</span>
          <span className="text-[11px] text-neutral-500 truncate">{adminUrl}</span>
        </div>
        <iframe
          title="Grand Opening raffle admin"
          src={adminUrl}
          className="h-[85vh] max-h-[900px] w-full border-0 bg-neutral-950"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
};

export default GrandOpeningDay;

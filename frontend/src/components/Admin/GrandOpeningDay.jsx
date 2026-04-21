import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const GOLD = '#D4A017';

const raffleOrigin = (import.meta.env.VITE_RAFFLE_ORIGIN || 'https://raffle.spectrumoutfitters.com').replace(
  /\/$/,
  ''
);

/**
 * Staff-only: live raffle dashboard (iframe) for all logged-in users.
 * Setup / infrastructure notes only for admins (tied to login app, not public raffle).
 */
const GrandOpeningDay = () => {
  const { isAdmin } = useAuth();
  const adminUrl = `${raffleOrigin}/admin/grand-opening`;
  const publicEntryUrl = `${raffleOrigin}/e/grand-opening`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">Grand Opening Day · Raffle</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400 max-w-3xl">
          Live entry counts and draws run in the raffle app. Use the raffle admin key in the panel below (it stays in this
          browser session only). Employees see this dashboard; only admins see setup instructions on this page.
        </p>
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

      {isAdmin && (
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30 p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Admin · Setup (not shown to employees)</h3>
          <ul className="list-disc pl-5 text-sm text-amber-950/90 dark:text-amber-100/90 space-y-1.5">
            <li>
              <strong>APPS_SCRIPT_URL</strong> (Google Apps Script web app URL): either add repo secret{' '}
              <code className="rounded bg-black/10 dark:bg-black/30 px-1">RAFFLE_APPS_SCRIPT_URL</code> (Actions writes{' '}
              <code className="rounded bg-black/10 dark:bg-black/30 px-1">/etc/spectrum-raffle.env</code> on deploy) or create that file on the droplet manually, then redeploy or{' '}
              <code className="rounded bg-black/10 dark:bg-black/30 px-1">pm2 restart spectrum-raffle</code>.
            </li>
            <li>Deploy: push to <code className="rounded bg-black/10 dark:bg-black/30 px-1">main</code> — GitHub Actions ships the raffle app and nginx.</li>
            <li>
              DNS / SSL: A record for <code className="rounded bg-black/10 dark:bg-black/30 px-1">raffle</code> → droplet;{' '}
              <code className="rounded bg-black/10 dark:bg-black/30 px-1">certbot --nginx -d raffle.spectrumoutfitters.com</code>.
            </li>
            <li>
              Detailed steps live in the repo: <code className="rounded bg-black/10 dark:bg-black/30 px-1">raffle-platform/scripts/SETUP_SERVER.md</code>.
            </li>
          </ul>
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

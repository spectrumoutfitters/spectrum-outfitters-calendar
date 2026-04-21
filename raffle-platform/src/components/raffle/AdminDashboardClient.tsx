"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminEventConfigPanel } from "@/components/raffle/AdminEventConfigPanel";
import type { AdminStats } from "@/lib/types";

type WinnerInfo = {
  name: string;
  phone: string;
  email: string;
  raffleId: string;
  ticketsInPool: number;
  drawId: string;
};

type Props = {
  slug: string;
};

const STORAGE_KEY = "raffle_admin_key";

function formatAdminApiError(code: string | undefined): string {
  if (code === "unauthorized") {
    return (
      "Admin key was rejected. Paste the exact value from your Google Sheet (Events row for this slug, column adminKey) — " +
      "no extra spaces. If you just created a new Apps Script project, open it from Extensions → Apps Script on this spreadsheet so it stays bound to the same file."
    );
  }
  if (code === "apps_script_timeout") {
    return (
      "Google Apps Script took too long to respond (cold start or heavy sheet). Wait 30 seconds and reload. " +
      "If this keeps happening, open the script from your spreadsheet and run a quick test, then try again."
    );
  }
  if (code === "server_misconfigured") {
    return (
      "The raffle server is missing APPS_SCRIPT_URL. That must be your Apps Script web app URL (starts with https://script.google.com/macros/s/ and ends with /exec)—not your Google Sheet link (docs.google.com/spreadsheets/…). " +
      "From the sheet: Extensions → Apps Script → Deploy → Manage deployments → copy the Web app URL. " +
      "On the droplet: put APPS_SCRIPT_URL=…/exec in /etc/spectrum-raffle.env, copy that file to /opt/spectrum-raffle/raffle-platform/.env.local, then pm2 restart spectrum-raffle. " +
      "Or set GitHub secret RAFFLE_APPS_SCRIPT_URL and push main."
    );
  }
  return code || "Request failed";
}

/** One ticket = one chance in the drum; draw picks uniformly among tickets (see drawWinner in Apps Script). */
function rafflePoolOdds(tickets: number, people: number): { oneIn: string; pctLabel: string; avgTickets: string } {
  if (tickets <= 0) {
    return { oneIn: "—", pctLabel: "No tickets yet", avgTickets: people > 0 ? "0" : "—" };
  }
  const pct = 100 / tickets;
  const pctLabel =
    pct >= 10 ? `~${pct.toFixed(0)}%` : pct >= 1 ? `~${pct.toFixed(1)}%` : `~${pct.toFixed(2)}%`;
  const avgTickets =
    people > 0 ? (tickets / people).toFixed(people > 5 ? 1 : 2) : tickets > 0 ? String(tickets) : "—";
  return {
    oneIn: `1 in ${tickets.toLocaleString()}`,
    pctLabel: `${pctLabel} per ticket`,
    avgTickets,
  };
}

export function AdminDashboardClient({ slug }: Props) {
  const [adminKey, setAdminKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raffleId, setRaffleId] = useState("");
  const [testModeOnly, setTestModeOnly] = useState(false);
  const [lastWinnerPhone, setLastWinnerPhone] = useState<string | null>(null);
  const [winner, setWinner] = useState<WinnerInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [showItemEditor, setShowItemEditor] = useState(false);
  const editorAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const k = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    if (k) {
      setSavedKey(k);
      setAdminKey(k);
    }
  }, []);

  const effectiveKey = savedKey || adminKey;

  const persistKey = () => {
    window.sessionStorage.setItem(STORAGE_KEY, adminKey.trim());
    setSavedKey(adminKey.trim());
  };

  const loadStats = useCallback(async () => {
    if (!effectiveKey.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/stats`, {
        method: "POST",
        headers: { "x-admin-key": effectiveKey.trim() },
      });
      const data = (await res.json()) as { ok?: boolean; stats?: AdminStats; error?: string };
      if (!res.ok || !data.ok || !data.stats) {
        setError(formatAdminApiError(data.error) || "Could not load stats");
        setStats(null);
        return;
      }
      setStats(data.stats);
      const ids = Object.keys(data.stats.entriesByRaffle);
      setRaffleId((prev) => prev || ids[0] || "");
    } catch {
      setError("Network error");
    }
  }, [effectiveKey, slug]);

  useEffect(() => {
    if (!effectiveKey.trim()) return;
    void loadStats();
    const id = window.setInterval(() => void loadStats(), 5000);
    return () => window.clearInterval(id);
  }, [effectiveKey, loadStats]);

  const raffleIds = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats.entriesByRaffle).sort((a, b) => {
      const ta = stats.entriesByRaffle[a]?.raffleTitle ?? a;
      const tb = stats.entriesByRaffle[b]?.raffleTitle ?? b;
      return ta.localeCompare(tb);
    });
  }, [stats]);

  useEffect(() => {
    if (showItemEditor && editorAnchorRef.current) {
      editorAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showItemEditor]);

  async function runDraw(excludePhones: string[]) {
    if (!effectiveKey.trim() || !raffleId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/draw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": effectiveKey.trim(),
        },
        body: JSON.stringify({ raffleId, excludePhones, testModeOnly }),
      });
      const data = (await res.json()) as
        | { ok: true; winner: WinnerInfo }
        | { ok: false; error: string };
      if (!res.ok || !data.ok) {
        setError(!data.ok ? formatAdminApiError(data.error) : "Draw failed");
        setWinner(null);
        return;
      }
      setWinner(data.winner);
      setLastWinnerPhone(data.winner.phone);
      void loadStats();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    if (!effectiveKey.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/export`, {
        method: "POST",
        headers: { "x-admin-key": effectiveKey.trim() },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(formatAdminApiError((j as { error?: string }).error) || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `entries-${slug}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-dashboard min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto max-w-screen-lg px-4 py-10 md:px-6 lg:max-w-6xl lg:px-8">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Admin</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Event · {slug}</h1>
            <p className="mt-2 max-w-prose text-sm text-neutral-400">
              Live stats refresh every 5 seconds. Draw uses ticket-weighted random selection among eligible rows.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="password"
              placeholder="Admin key"
              className="h-12 min-w-[220px] rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-100"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
            />
            <button
              type="button"
              onClick={persistKey}
              className="h-12 rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-900"
            >
              Save key (session)
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {!effectiveKey.trim() ? (
          <div className="rounded-3xl border border-dashed border-neutral-700 bg-neutral-900/60 p-8 text-center text-sm text-neutral-400">
            Enter your admin key from the Google Sheet <code className="font-mono">Events.adminKey</code> (or global{" "}
            <code className="font-mono">ADMIN_MASTER_KEY</code> script property), then save to session.
          </div>
        ) : null}

        {effectiveKey.trim() && !stats && !error ? (
          <div className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900/80 px-4 py-6 text-center text-sm text-neutral-400">
            Loading live stats…
          </div>
        ) : null}

        {stats ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm lg:col-span-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                Participants
              </h2>
              <p className="mt-3 text-4xl font-semibold tabular-nums">{stats.totalParticipants}</p>
              <p className="mt-1 text-sm text-neutral-400">
                Unique phones:{" "}
                <span className="font-semibold text-neutral-100">{stats.uniqueParticipants}</span>
              </p>
              {typeof stats.entryRowCount === "number" && stats.entryRowCount > stats.uniqueParticipants ? (
                <p className="mt-2 text-xs text-neutral-500">
                  Sheet rows: {stats.entryRowCount} (higher when entrants split tickets across pools)
                </p>
              ) : null}
              <p className="mt-4 text-xs text-neutral-500">
                Last sync: {new Date(stats.lastUpdated).toLocaleString()}
              </p>
            </section>

            <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                Entries by prize pool
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                <span className="font-medium text-neutral-400">People</span> = distinct phones in that pool.{" "}
                <span className="font-medium text-neutral-400">Win odds</span> = if one more ticket were added now, chance
                that ticket is picked on the next draw (same weighted ticket draw as the Draw button).
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
                      <th className="py-2 pr-3">Prize pool</th>
                      <th className="py-2 pr-3">People</th>
                      <th className="py-2 pr-3">Tickets</th>
                      <th className="py-2 pr-3">Avg tickets / person</th>
                      <th className="py-2">Win chance (1 new ticket)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raffleIds.map((id) => {
                      const row = stats.entriesByRaffle[id];
                      if (!row) return null;
                      const odds = rafflePoolOdds(row.tickets, row.people);
                      return (
                        <tr key={id} className="border-b border-neutral-800 last:border-0">
                          <td className="py-3 pr-3 font-medium">{row.raffleTitle}</td>
                          <td className="py-3 pr-3 tabular-nums text-neutral-300">{row.people}</td>
                          <td className="py-3 pr-3 tabular-nums text-neutral-100">{row.tickets}</td>
                          <td className="py-3 pr-3 tabular-nums text-neutral-400">{odds.avgTickets}</td>
                          <td className="py-3">
                            <span className="font-semibold text-amber-200 tabular-nums">{odds.oneIn}</span>
                            <span className="mt-0.5 block text-xs font-normal text-neutral-500">{odds.pctLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm lg:col-span-3">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-200">Raffle pool</label>
                    <select
                      className="mt-1 h-12 w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100"
                      value={raffleId}
                      onChange={(e) => setRaffleId(e.target.value)}
                    >
                      {raffleIds.map((id) => (
                        <option key={id} value={id}>
                          {stats.entriesByRaffle[id]?.raffleTitle ?? id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-3 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-neutral-600 bg-neutral-900 text-amber-600"
                      checked={testModeOnly}
                      onChange={(e) => setTestModeOnly(e.target.checked)}
                    />
                    Draw from test entries only (QA pool)
                  </label>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={busy || !raffleId}
                    onClick={() => void runDraw([])}
                    className="h-12 min-w-[140px] rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 px-4 text-sm font-semibold text-white shadow disabled:opacity-50"
                  >
                    Draw winner
                  </button>
                  <button
                    type="button"
                    disabled={busy || !raffleId || !lastWinnerPhone}
                    onClick={() => void runDraw(lastWinnerPhone ? [lastWinnerPhone] : [])}
                    className="h-12 min-w-[140px] rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-sm font-semibold text-neutral-100 shadow-sm disabled:opacity-50"
                  >
                    Redraw (exclude last)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void exportCsv()}
                    className="h-12 min-w-[140px] rounded-xl border border-neutral-700 bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 shadow-sm disabled:opacity-50"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {winner ? (
                <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-950 dark:text-emerald-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                    Current draw
                  </p>
                  <p className="mt-2 text-lg font-semibold">{winner.name}</p>
                  <p className="mt-1 text-emerald-900/90 dark:text-emerald-100/90">
                    {winner.phone} · {winner.email}
                  </p>
                  <p className="mt-2 text-xs text-emerald-900/80 dark:text-emerald-100/80">
                    Pool tickets at draw: {winner.ticketsInPool} · Draw id: {winner.drawId}
                  </p>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {effectiveKey.trim() ? (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowItemEditor((v) => !v)}
              className="h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 px-4 text-sm font-semibold text-white shadow hover:opacity-95"
            >
              {showItemEditor ? "Hide add / edit items" : "Add or edit items"}
            </button>
            <p className="max-w-xl text-xs text-neutral-500">
              Opens the full prize editor (IDs, titles, images, values, event branding). Live stats and draw tools stay above.
            </p>
          </div>
        ) : null}

        {effectiveKey.trim() && showItemEditor ? (
          <div ref={editorAnchorRef} className="mt-8 scroll-mt-8">
            <AdminEventConfigPanel slug={slug} adminKey={effectiveKey.trim()} onSaved={() => void loadStats()} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

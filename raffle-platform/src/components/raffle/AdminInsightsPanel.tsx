"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminInsights, AdminInsightsRecentEntry } from "@/lib/types";

type Props = {
  slug: string;
  adminKey: string;
  /** Called when the upstream key is rejected so the parent can surface an error. */
  onUnauthorized?: () => void;
};

type RefundTarget = {
  stripeSessionId: string;
  amountCents: number;
  currency: string;
  poolTitle: string;
  name: string;
  ts: string;
  tickets: number;
};

function formatMoney(cents: number, currency: string): string {
  if (!Number.isFinite(cents)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase() || "USD",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase() || "USD"}`;
  }
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function formatDay(day: string): string {
  if (!day) return "";
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
}

export function AdminInsightsPanel({ slug, adminKey, onUnauthorized }: Props) {
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Refund dialog state
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);
  const [refundPassword, setRefundPassword] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundNote, setRefundNote] = useState<string | null>(null);
  const refundInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!adminKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/insights`, {
        method: "POST",
        headers: { "x-admin-key": adminKey.trim() },
      });
      const data = (await res.json()) as { ok?: boolean; insights?: AdminInsights; error?: string };
      if (!res.ok || !data.ok || !data.insights) {
        if (data.error === "unauthorized") {
          onUnauthorized?.();
        }
        setError(data.error === "unknown_action"
          ? "Apps Script is missing the getAdminInsights handler — paste the latest Code.gs and redeploy the web app."
          : data.error || "Could not load insights.");
        return;
      }
      setInsights(data.insights);
    } catch {
      setError("Network error loading insights.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, slug, onUnauthorized]);

  useEffect(() => {
    if (!adminKey.trim()) return;
    void load();
    const id = window.setInterval(() => void load(), 7000);
    return () => window.clearInterval(id);
  }, [adminKey, load]);

  useEffect(() => {
    if (refundTarget && refundInputRef.current) {
      refundInputRef.current.focus();
    }
  }, [refundTarget]);

  function openRefundDialog(target: RefundTarget) {
    setRefundTarget(target);
    setRefundPassword("");
    setRefundError(null);
    setRefundNote(null);
  }

  function closeRefundDialog() {
    if (refundBusy) return;
    setRefundTarget(null);
    setRefundPassword("");
    setRefundError(null);
  }

  async function submitRefund() {
    if (!refundTarget || refundBusy) return;
    if (!refundPassword) {
      setRefundError("Type your admin password to confirm.");
      return;
    }
    setRefundBusy(true);
    setRefundError(null);
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(slug)}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim(),
        },
        body: JSON.stringify({
          stripeSessionId: refundTarget.stripeSessionId,
          adminPassword: refundPassword,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        refundId?: string | null;
        sheet?: { ticketsRefunded?: number; rowsChanged?: number; alreadyRefunded?: boolean };
      };
      if (!res.ok || !data.ok) {
        setRefundError(formatRefundError(data.error));
        setRefundBusy(false);
        return;
      }
      const removed = data.sheet?.ticketsRefunded ?? refundTarget.tickets;
      const noteParts = [
        `Refunded ${formatMoney(refundTarget.amountCents, refundTarget.currency)}`,
        `${removed} ticket${removed === 1 ? "" : "s"} removed`,
      ];
      if (data.refundId) noteParts.push(`Stripe refund ${data.refundId}`);
      setRefundNote(noteParts.join(" · "));
      setRefundTarget(null);
      setRefundPassword("");
      void load();
    } catch {
      setRefundError("Network error. The refund did not complete — try again.");
    } finally {
      setRefundBusy(false);
    }
  }

  const currency = insights?.currency || "usd";
  const totals = insights?.totals;
  const revenueDays = useMemo(() => {
    if (!insights?.revenueByDay) return [];
    return insights.revenueByDay.slice(-14).reverse();
  }, [insights]);

  return (
    <section className="mt-8 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-50">Insights</h2>
          <p className="text-xs text-neutral-500">
            Auto-refreshes every 7s · last sync {insights ? formatDateTime(insights.lastUpdated) : loading ? "…" : "—"}
          </p>
        </div>
        {insights ? (
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
            {insights.paidTicketsEnabled ? "Paid tickets ON" : "Paid tickets OFF"}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-100">{error}</div>
      ) : null}

      {totals ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="People entered" value={totals.uniqueParticipants.toLocaleString()} hint={`${totals.paidParticipants.toLocaleString()} paid`} />
          <Stat label="Total tickets" value={totals.totalTickets.toLocaleString()} hint={`${totals.freeTickets.toLocaleString()} free · ${totals.paidTickets.toLocaleString()} paid`} />
          <Stat label="Paid purchases" value={totals.paidPurchases.toLocaleString()} hint={`${totals.paidTickets.toLocaleString()} tickets sold`} />
          <Stat label="Revenue" value={formatMoney(totals.totalRevenueCents, currency)} hint={`${currency.toUpperCase()} from Stripe`} />
        </div>
      ) : null}

      {totals && (totals.newsletterOptIns ?? 0) > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Newsletter opt-ins"
            value={(totals.newsletterOptIns ?? 0).toLocaleString()}
            hint={`${(totals.newsletterConfirmed ?? 0).toLocaleString()} confirmed`}
          />
          <Stat
            label="Pending confirmations"
            value={Math.max(0, (totals.newsletterOptIns ?? 0) - (totals.newsletterConfirmed ?? 0)).toLocaleString()}
            hint="Awaiting email click"
          />
          <Stat
            label="Bonus tickets awarded"
            value={(totals.newsletterBonusTickets ?? 0).toLocaleString()}
            hint="From confirmed opt-ins"
          />
        </div>
      ) : null}

      {insights ? (
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Pool breakdown</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Free vs paid tickets, distinct entrants, and revenue per pool. Tickets carry equal weight in the draw regardless of source.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3">Pool</th>
                  <th className="py-2 pr-3">People</th>
                  <th className="py-2 pr-3">Tickets</th>
                  <th className="py-2 pr-3">Free</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Buyers</th>
                  <th className="py-2 pr-3">Purchases</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2">Draw at</th>
                </tr>
              </thead>
              <tbody>
                {insights.pools.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-xs text-neutral-500">
                      No entries yet for this event.
                    </td>
                  </tr>
                ) : null}
                {insights.pools.map((p) => (
                  <tr key={p.raffleId} className="border-b border-neutral-800 last:border-0 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-neutral-50">{p.title}</p>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                        {p.raffleId}
                        {p.active ? "" : " · inactive"}
                      </p>
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-neutral-200">{p.people}</td>
                    <td className="py-3 pr-3 tabular-nums font-semibold text-neutral-50">{p.tickets}</td>
                    <td className="py-3 pr-3 tabular-nums text-neutral-300">{p.freeTickets}</td>
                    <td className="py-3 pr-3 tabular-nums text-amber-200">{p.paidTickets}</td>
                    <td className="py-3 pr-3 tabular-nums text-neutral-200">{p.paidPeople}</td>
                    <td className="py-3 pr-3 tabular-nums text-neutral-300">{p.paidPurchases}</td>
                    <td className="py-3 pr-3 tabular-nums text-emerald-300">{formatMoney(p.paidRevenueCents, currency)}</td>
                    <td className="py-3 text-xs text-neutral-400">{p.drawAt ? formatDateTime(p.drawAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {insights && insights.recentEntries.length > 0 ? (
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Recent entries (50)</h3>
              <p className="mt-1 text-xs text-neutral-500">
                Newest first. Email is masked. Includes split-rows so paid lines show separately. Refunded paid rows stay
                visible (excluded from totals) for audit.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Pool</th>
                  <th className="py-2 pr-3">Tickets</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {insights.recentEntries.map((row, idx) => {
                  const poolTitle = insights.pools.find((p) => p.raffleId === row.raffleId)?.title || row.raffleId;
                  return (
                    <tr key={`${row.ts}-${row.phoneLast4}-${idx}`} className="border-b border-neutral-800 last:border-0 align-top">
                      <td className="py-2 pr-3 text-xs text-neutral-400">{formatDateTime(row.ts)}</td>
                      <td className="py-2 pr-3 text-neutral-100">{row.name || "—"}</td>
                      <td className="py-2 pr-3 text-neutral-300">{row.emailMasked || "—"}</td>
                      <td className="py-2 pr-3 tabular-nums text-neutral-300">···{row.phoneLast4}</td>
                      <td className="py-2 pr-3 text-neutral-200">{poolTitle}</td>
                      <td
                        className={[
                          "py-2 pr-3 tabular-nums font-semibold",
                          row.refunded ? "text-neutral-500 line-through" : "text-neutral-50",
                        ].join(" ")}
                      >
                        {row.tickets}
                      </td>
                      <td className="py-2 pr-3">{renderSourceBadge(row, currency)}</td>
                      <td className="py-2">
                        {row.paid && row.stripeSessionId && !row.refunded ? (
                          <button
                            type="button"
                            className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-500/20"
                            onClick={() =>
                              openRefundDialog({
                                stripeSessionId: row.stripeSessionId || "",
                                amountCents: row.paidAmountCents,
                                currency: row.currency || currency,
                                poolTitle,
                                name: row.name || row.emailMasked || `···${row.phoneLast4}`,
                                ts: row.ts,
                                tickets: row.tickets,
                              })
                            }
                          >
                            Refund
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {refundTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRefundDialog();
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-neutral-50">Refund this purchase?</h3>
            <p className="mt-1 text-xs text-neutral-400">
              Refunds the Stripe charge and removes those tickets from the pool. The row stays in the sheet marked refunded
              for audit. This cannot be undone from inside the app.
            </p>

            <dl className="mt-4 space-y-1 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3 text-xs text-neutral-300">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Buyer</dt>
                <dd className="text-neutral-100">{refundTarget.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Pool</dt>
                <dd>{refundTarget.poolTitle}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Tickets to remove</dt>
                <dd className="tabular-nums text-amber-200">{refundTarget.tickets}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Amount</dt>
                <dd className="tabular-nums text-emerald-300">{formatMoney(refundTarget.amountCents, refundTarget.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Charged at</dt>
                <dd className="text-neutral-300">{formatDateTime(refundTarget.ts)}</dd>
              </div>
              <div className="flex justify-between gap-3 break-all">
                <dt className="text-neutral-500">Stripe session</dt>
                <dd className="font-mono text-[10px] text-neutral-400">{refundTarget.stripeSessionId}</dd>
              </div>
            </dl>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-neutral-300">
              Re-enter your admin password to confirm
            </label>
            <input
              ref={refundInputRef}
              type="password"
              autoComplete="off"
              value={refundPassword}
              onChange={(e) => setRefundPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitRefund();
                }
              }}
              className="mt-1 h-11 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:border-amber-400"
              placeholder="Admin password"
              disabled={refundBusy}
            />

            {refundError ? (
              <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {refundError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="h-11 rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-sm font-medium text-neutral-200 hover:bg-neutral-900"
                onClick={closeRefundDialog}
                disabled={refundBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-11 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white shadow hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void submitRefund()}
                disabled={refundBusy || refundPassword.length === 0}
              >
                {refundBusy ? "Refunding…" : `Refund ${formatMoney(refundTarget.amountCents, refundTarget.currency)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {refundNote ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          {refundNote}
        </div>
      ) : null}

      {insights && insights.topEntrants.length > 0 ? (
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Top entrants by ticket count</h3>
          <p className="mt-1 text-xs text-neutral-500">Highest combined ticket totals across all pools (free + paid).</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Tickets</th>
                  <th className="py-2 pr-3">Free</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2">Spent</th>
                </tr>
              </thead>
              <tbody>
                {insights.topEntrants.map((e, idx) => (
                  <tr key={`${e.phoneLast4}-${idx}`} className="border-b border-neutral-800 last:border-0">
                    <td className="py-2 pr-3 text-neutral-100">{e.name || "—"}</td>
                    <td className="py-2 pr-3 tabular-nums text-neutral-300">···{e.phoneLast4}</td>
                    <td className="py-2 pr-3 text-neutral-300">{e.emailMasked || "—"}</td>
                    <td className="py-2 pr-3 tabular-nums font-semibold text-neutral-50">{e.tickets}</td>
                    <td className="py-2 pr-3 tabular-nums text-neutral-300">{e.freeTickets}</td>
                    <td className="py-2 pr-3 tabular-nums text-amber-200">{e.paidTickets}</td>
                    <td className="py-2 tabular-nums text-emerald-300">{formatMoney(e.paidCents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {insights && revenueDays.length > 0 ? (
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Revenue · last 14 days</h3>
          <ul className="mt-3 divide-y divide-neutral-800 text-sm">
            {revenueDays.map((d) => (
              <li key={d.day} className="flex items-center justify-between py-2">
                <span className="text-neutral-300">{formatDay(d.day)}</span>
                <span className="tabular-nums font-semibold text-emerald-300">{formatMoney(d.amountCents, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-50">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-neutral-500">{hint}</p> : null}
    </div>
  );
}

function renderSourceBadge(row: AdminInsightsRecentEntry, fallbackCurrency: string) {
  if (row.refunded) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-200">
        Refunded · {formatMoney(row.paidAmountCents, row.currency || fallbackCurrency)}
      </span>
    );
  }
  if (row.paid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
        Paid · {formatMoney(row.paidAmountCents, row.currency || fallbackCurrency)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-semibold text-neutral-300">
      Free
    </span>
  );
}

function formatRefundError(code: string | undefined): string {
  if (!code) return "Refund failed.";
  if (code === "password_required") return "Type your admin password to confirm.";
  if (code === "password_mismatch") return "Password didn't match the saved admin key.";
  if (code === "missing_admin_key") return "Admin key missing — re-enter it at the top of the page.";
  if (code === "unauthorized") return "Admin key was rejected.";
  if (code === "missing_session") return "Stripe session id was missing on this row.";
  if (code === "not_paid") return "Stripe says this session is not in 'paid' state.";
  if (code === "no_payment_intent") return "Stripe couldn't return a payment intent for this session.";
  if (code === "stripe_not_configured") return "STRIPE_SECRET_KEY is not set on the server.";
  if (code === "server_misconfigured") return "APPS_SCRIPT_URL is not set on the server.";
  if (code.startsWith("stripe_missing_refund_permission")) return code.split(": ")[1] || code;
  if (code.startsWith("refund_done_but_sheet_failed")) {
    return "Stripe refund went through but the sheet did not update — re-run, or zero those tickets manually. Details: " + code;
  }
  return code;
}

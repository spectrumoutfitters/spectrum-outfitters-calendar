"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventConfig, RaffleOption } from "@/lib/types";
import { PoolTicketField } from "@/components/raffle/PoolTicketField";
import {
  emptyPoolTickets,
  maxTicketsForPool,
  sumPoolTickets,
} from "@/lib/poolTicketAlloc";

type Props = {
  event: EventConfig;
  /** Magic-link entry token tied to the entrant who'll receive the tickets. */
  entryToken: string;
  /** When provided, restrict purchases to these pool IDs (e.g. the entrant's existing pools). */
  restrictToPoolIds?: string[];
  /** Disable buying entirely (entry locked, etc). */
  disabled?: boolean;
};

function formatMoney(cents: number, currency: string): string {
  if (!Number.isFinite(cents)) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function BuyTicketsCard({ event, entryToken, restrictToPoolIds, disabled }: Props) {
  const priceCents = Math.max(0, Math.floor(Number(event.ticketPriceCents) || 0));
  const currency = String(event.ticketCurrency || "usd").toLowerCase();
  const maxPerPurchase = Math.max(1, Math.floor(Number(event.paidTicketsMaxPerPurchase) || 100));

  const buyablePools = useMemo<RaffleOption[]>(() => {
    if (restrictToPoolIds && restrictToPoolIds.length) {
      const set = new Set(restrictToPoolIds);
      return event.raffles.filter((r) => set.has(r.id));
    }
    return event.raffles;
  }, [event.raffles, restrictToPoolIds]);

  const orderedIds = useMemo(() => buyablePools.map((r) => r.id), [buyablePools]);

  const [poolTickets, setPoolTickets] = useState<Record<string, number>>(() => emptyPoolTickets(orderedIds));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPoolTickets((prev) => {
      const next: Record<string, number> = {};
      for (const id of orderedIds) next[id] = Math.max(0, Math.floor(Number(prev[id]) || 0));
      return next;
    });
  }, [orderedIds]);

  const totalTickets = sumPoolTickets(orderedIds, poolTickets);
  const totalCents = totalTickets * priceCents;
  const enabled = Boolean(event.paidTicketsEnabled) && priceCents > 0 && buyablePools.length > 0;

  if (!enabled) {
    return null;
  }

  function setPoolCount(id: string, n: number) {
    setPoolTickets((prev) => {
      const next = { ...prev, [id]: Math.max(0, Math.floor(n)) };
      const cap = maxTicketsForPool(id, orderedIds, prev, maxPerPurchase);
      if (next[id] > cap) next[id] = cap;
      return next;
    });
  }

  async function onCheckout() {
    setError(null);
    if (totalTickets <= 0) {
      setError("Pick at least one ticket to buy.");
      return;
    }
    if (totalTickets > maxPerPurchase) {
      setError(`You can buy at most ${maxPerPurchase} tickets per checkout.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/raffle/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: event.slug, token: entryToken, ticketSplit: poolTickets }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        setError(formatCheckoutError(data.error));
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Try again in a moment.");
      setSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-3xl border border-stone-200 bg-white/85 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70"
      aria-label="Buy more raffle tickets"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-stone-900 dark:text-neutral-100">Buy more tickets</h3>
        <p className="text-xs text-stone-600 dark:text-neutral-400">
          {formatMoney(priceCents, currency)} per ticket · pick how many in each pool. Payment goes through Stripe and your tickets are added once payment clears.
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {buyablePools.map((pool) => {
          const count = Math.max(0, Math.floor(Number(poolTickets[pool.id]) || 0));
          const cap = maxTicketsForPool(pool.id, orderedIds, poolTickets, maxPerPurchase);
          return (
            <li
              key={pool.id}
              className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/60 p-3 dark:border-neutral-700 dark:bg-neutral-900/40"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-900 dark:text-neutral-100">{pool.title}</p>
                {pool.subtitle ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-stone-600 dark:text-neutral-400">{pool.subtitle}</p>
                ) : null}
              </div>
              <PoolTicketField
                inputId={`buy-${pool.id}`}
                label={pool.title}
                value={count}
                max={cap}
                disabled={disabled || submitting}
                onCommit={(n) => setPoolCount(pool.id, n)}
                inputClassName="h-9 w-16 rounded-xl border border-stone-300 bg-white px-2 text-right text-sm font-semibold text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-amber-400 dark:focus:ring-amber-500/40"
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/60">
        <div className="text-xs text-stone-600 dark:text-neutral-400">
          {totalTickets} ticket{totalTickets === 1 ? "" : "s"} · max {maxPerPurchase} per checkout
        </div>
        <div className="text-base font-bold text-stone-900 dark:text-neutral-100">
          {formatMoney(totalCents, currency)}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onCheckout}
        disabled={disabled || submitting || totalTickets <= 0}
        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-500"
      >
        {submitting ? "Opening Stripe…" : `Pay ${formatMoney(totalCents, currency)} with Stripe`}
      </button>
      <p className="mt-2 text-[11px] text-stone-500 dark:text-neutral-500">
        Free entries always count. This adds extra tickets to the pools you choose.
      </p>
    </section>
  );
}

function formatCheckoutError(code: string | undefined): string {
  switch (code) {
    case "paid_tickets_disabled":
      return "Paid tickets aren't enabled for this event yet.";
    case "ticket_price_not_set":
      return "Ticket pricing isn't configured yet — check back soon.";
    case "must_buy_at_least_one":
      return "Pick at least one ticket before checking out.";
    case "entry_locked":
      return "This entry is locked because a draw is too close to make changes.";
    case "stripe_not_configured":
      return "Online payments are temporarily unavailable.";
    case "missing_fields":
      return "Something is missing from the request — refresh and try again.";
    default:
      if (code && code.startsWith("max_")) return code.replace(/_/g, " ");
      return "Could not start checkout. Try again in a moment.";
  }
}

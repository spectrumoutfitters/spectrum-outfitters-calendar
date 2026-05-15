"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import type { EventConfig } from "@/lib/types";
import { trimBonusProofForSubmit, validateBonusProof } from "@/lib/bonusProof";
import { computeTicketsFromBonuses, resolveBonusRules } from "@/lib/entryMath";
import {
  countPositivePools,
  defaultPoolTickets,
  emptyPoolTickets,
  maxTicketsForPool,
  reconcilePoolTickets,
  sumPoolTickets,
} from "@/lib/poolTicketAlloc";
import { BonusToggle } from "./BonusToggle";
import { BuyTicketsCard } from "./BuyTicketsCard";
import { PoolTicketField } from "./PoolTicketField";

type Props = {
  event: EventConfig;
};

function formatMoney(cents: number, currency: string): string {
  if (!Number.isFinite(cents)) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatCheckoutError(code: string | undefined): string {
  switch (code) {
    case "paid_tickets_disabled":
      return "Paid tickets aren't enabled for this event yet.";
    case "ticket_price_not_set":
      return "Ticket pricing isn't configured yet.";
    case "must_buy_at_least_one":
      return "Pick at least one ticket before checking out.";
    case "entry_locked":
      return "This entry is locked because a draw is too close.";
    case "stripe_not_configured":
      return "Online payments are temporarily unavailable.";
    case "missing_fields":
      return "Something is missing from the request — refresh and try again.";
    default:
      if (code && code.startsWith("max_")) return code.replace(/_/g, " ");
      return "We couldn't open Stripe right now.";
  }
}

export function EventEntryClient({ event }: Props) {
  const searchParams = useSearchParams();
  const urlTest = searchParams.get("test") === "1";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const bonusRules = useMemo(() => resolveBonusRules(event), [event]);
  const baseTickets = Math.max(1, Math.floor(Number(event.baseTicketsPerEntry) || 2));
  const newsletterEnabled = event.newsletterBonusEnabled !== false;
  const newsletterBonus = Math.max(0, Math.floor(Number(event.newsletterBonusTickets) || 0));
  const [bonusById, setBonusById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bonusRules.map((r) => [r.id, false])),
  );
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const orderedIds = useMemo(() => event.raffles.map((r) => r.id), [event.raffles]);
  const [poolTickets, setPoolTickets] = useState<Record<string, number>>(() =>
    defaultPoolTickets(
      event.raffles.map((r) => r.id),
      computeTicketsFromBonuses(
        Object.fromEntries(bonusRules.map((r) => [r.id, false])),
        bonusRules,
        baseTickets,
      ),
    ),
  );
  const [bonusProof, setBonusProof] = useState<Record<string, Record<string, string>>>({});
  const [terms, setTerms] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [entryToken, setEntryToken] = useState<string>("");
  const [submittedPoolIds, setSubmittedPoolIds] = useState<string[]>([]);
  const [paidPoolTickets, setPaidPoolTickets] = useState<Record<string, number>>(() =>
    emptyPoolTickets(event.raffles.map((r) => r.id)),
  );

  const testMode = urlTest || event.defaultTestMode;

  // Paid-ticket configuration (derived from event sheet via Apps Script). We only render the buy
  // section when admin has explicitly enabled paid tickets AND set a non-zero per-ticket price.
  const priceCents = Math.max(0, Math.floor(Number(event.ticketPriceCents) || 0));
  const currency = String(event.ticketCurrency || "usd").toLowerCase();
  const maxPerPurchase = Math.max(1, Math.floor(Number(event.paidTicketsMaxPerPurchase) || 100));
  const paidEnabled = Boolean(event.paidTicketsEnabled) && priceCents > 0 && !testMode;

  const accent = event.primaryColor || "#c9a227";
  const secondary = event.secondaryColor || "#1c1917";

  const newsletterShowsBonus = newsletterEnabled && newsletterBonus > 0;

  const previewTickets = useMemo(() => {
    const baseOnly = computeTicketsFromBonuses(bonusById, bonusRules, baseTickets);
    if (newsletterShowsBonus && newsletterOptIn) return baseOnly + newsletterBonus;
    return baseOnly;
  }, [bonusById, bonusRules, baseTickets, newsletterShowsBonus, newsletterOptIn, newsletterBonus]);

  useEffect(() => {
    setPoolTickets((prev) => reconcilePoolTickets(orderedIds, prev, previewTickets));
  }, [orderedIds, previewTickets]);

  // Keep paid-ticket map in sync if pools change (e.g. admin renames pools while form is open).
  useEffect(() => {
    setPaidPoolTickets((prev) => {
      const next: Record<string, number> = {};
      for (const id of orderedIds) next[id] = Math.max(0, Math.floor(Number(prev[id]) || 0));
      return next;
    });
  }, [orderedIds]);

  const paidTotal = useMemo(
    () => sumPoolTickets(orderedIds, paidPoolTickets),
    [orderedIds, paidPoolTickets],
  );
  const paidCostCents = paidTotal * priceCents;

  const assignedTotal = useMemo(() => sumPoolTickets(orderedIds, poolTickets), [orderedIds, poolTickets]);
  const selectedIdsOrdered = useMemo(
    () => orderedIds.filter((id) => (poolTickets[id] ?? 0) > 0),
    [orderedIds, poolTickets],
  );
  const selectedCount = selectedIdsOrdered.length;

  const selectedPrize = useMemo(
    () => (selectedCount === 1 ? (event.raffles.find((r) => r.id === selectedIdsOrdered[0]) ?? null) : null),
    [event.raffles, selectedCount, selectedIdsOrdered],
  );

  const multiPool = event.raffles.length >= 2;

  function setBonus(id: string, v: boolean) {
    setBonusById((prev) => ({ ...prev, [id]: v }));
    if (!v) {
      setBonusProof((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function updateProof(ruleId: string, fieldId: string, value: string) {
    setBonusProof((prev) => ({
      ...prev,
      [ruleId]: { ...(prev[ruleId] ?? {}), [fieldId]: value },
    }));
  }

  const isDark = event.theme === "dark";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const poolSum = sumPoolTickets(orderedIds, poolTickets);
    if (countPositivePools(orderedIds, poolTickets) < 1) {
      setStatus("error");
      setMessage("Give at least one ticket to a prize pool (use the number next to each pool).");
      return;
    }
    if (poolSum !== previewTickets) {
      setStatus("error");
      setMessage(
        `Tickets per pool must add up to ${previewTickets} (you have ${poolSum} assigned). Adjust each pool so the counts match your total.`,
      );
      return;
    }
    if (!terms) {
      setStatus("error");
      setMessage("Please accept the official rules and terms.");
      return;
    }
    const proofErr = validateBonusProof(bonusProof, bonusRules, bonusById);
    if (proofErr) {
      setStatus("error");
      setMessage(proofErr);
      return;
    }
    setStatus("loading");
    try {
      const baseBody: Record<string, unknown> = {
        slug: event.slug,
        name,
        phone,
        email,
        bonusById,
        bonusInstagram: Boolean(bonusById.instagram),
        bonusReview: Boolean(bonusById.review),
        bonusReferral: Boolean(bonusById.referral),
        newsletterOptIn: newsletterShowsBonus ? newsletterOptIn : false,
        company,
        termsAccepted: terms,
        testMode,
      };
      const trimmedProof = trimBonusProofForSubmit(bonusProof, bonusRules);
      if (Object.keys(trimmedProof).length) baseBody.bonusProof = trimmedProof;

      const ticketSplit = Object.fromEntries(orderedIds.map((id) => [id, poolTickets[id] ?? 0]));
      if (selectedIdsOrdered.length === 1) {
        baseBody.ticketMode = "single";
        baseBody.raffleId = selectedIdsOrdered[0];
      } else {
        baseBody.ticketMode = "split";
        baseBody.splitEvenly = false;
        baseBody.ticketSplit = ticketSplit;
        baseBody.raffleId = selectedIdsOrdered[0];
      }

      const res = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        totalEntries?: number;
        poolsEntered?: number;
        error?: string;
        message?: string;
        magicLinkSent?: boolean;
        entryToken?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
        return;
      }
      const token = String(data.entryToken || "");

      // If user picked paid tickets, immediately kick off Stripe Checkout. Free entry is already
      // saved in the sheet, so even if checkout fails the user keeps their free entry.
      let stripeRedirected = false;
      let buyError: string | null = null;
      if (paidEnabled && paidTotal > 0 && token) {
        try {
          const cr = await fetch("/api/raffle/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug: event.slug,
              token,
              ticketSplit: paidPoolTickets,
            }),
          });
          const cd = (await cr.json()) as { ok?: boolean; url?: string; error?: string };
          if (cr.ok && cd.ok && cd.url) {
            window.location.href = cd.url;
            stripeRedirected = true;
          } else {
            buyError = formatCheckoutError(cd.error);
          }
        } catch {
          buyError = "We couldn't reach Stripe right now.";
        }
      }
      if (stripeRedirected) return;

      setStatus("success");
      setEntryToken(token);
      setSubmittedPoolIds(selectedIdsOrdered.slice());
      const splitNote =
        selectedIdsOrdered.length > 1 && typeof data.poolsEntered === "number"
          ? ` Recorded across ${data.poolsEntered} prize pool${data.poolsEntered === 1 ? "" : "s"} with your ticket split.`
          : "";
      const emailManageNote =
        !testMode && data.magicLinkSent
          ? " Check your email for a private link to view or change your ticket split until shortly before each scheduled draw."
          : !testMode
            ? " If email is configured for this giveaway, you may receive a link to manage your entry from the same address you entered with."
            : "";
      const buyNote = buyError
        ? ` Heads up: ${buyError} Use your email manage-link below to buy tickets later.`
        : "";
      setMessage(
        data.message ||
          (testMode
            ? `Test entry recorded (${data.totalEntries ?? previewTickets} tickets).${splitNote}`
            : `You’re in! ${data.totalEntries ?? previewTickets} total tickets.${splitNote}${emailManageNote}${buyNote}`),
      );
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <div
      className={[
        "min-h-dvh touch-pan-y bg-[var(--background)] text-[var(--foreground)]",
        isDark ? "dark" : "",
      ].join(" ")}
      style={
        {
          "--background": isDark ? "#0c0a09" : "#fafaf9",
          "--foreground": isDark ? "#fafaf9" : "#0c0a09",
          "--brand": accent,
          "--brand-2": secondary,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-lg px-3 pt-6 sm:px-5 sm:pt-8 md:max-w-xl">
        <header className="mb-8 flex flex-col items-center text-center sm:mb-10">
          {event.logoUrl ? (
            <div className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.logoUrl} alt="" className="max-h-full max-w-full object-contain p-2" />
            </div>
          ) : (
            <div className="mb-4 w-full max-w-xs px-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/spectrum-outfitters-logo.png"
                alt="Spectrum Outfitters"
                className="mx-auto h-auto w-full object-contain"
              />
            </div>
          )}
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-stone-900 dark:text-neutral-50 sm:text-3xl md:text-4xl">
            {event.name}
          </h1>
          {event.description ? (
            <p className="mt-3 max-w-prose text-pretty text-[15px] leading-relaxed text-stone-600 dark:text-neutral-400 sm:text-base">
              {event.description}
            </p>
          ) : null}
          {testMode ? (
            <div className="mt-4 inline-flex max-w-[95vw] items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-[11px] font-semibold uppercase leading-snug tracking-wide text-amber-900 dark:text-amber-100 sm:text-xs">
              Test mode — entries may be flagged or blocked
            </div>
          ) : null}
        </header>

        <div
          className="mx-auto mb-8 max-w-lg rounded-2xl border px-4 py-4 text-left shadow-sm backdrop-blur-sm sm:mb-10 sm:px-5 sm:text-center dark:shadow-none"
          style={{
            borderColor: `${accent}44`,
            background: isDark ? `linear-gradient(145deg, ${accent}18, transparent 55%, ${secondary}12)` : `linear-gradient(145deg, ${accent}14, #fff8 45%)`,
          }}
        >
          <p className="text-sm font-semibold tracking-wide text-stone-900 dark:text-neutral-50">Free to enter</p>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-stone-800 dark:text-neutral-200">
            One submission per phone. Put <strong className="font-semibold">all</strong> your tickets in one prize pool,
            or <strong className="font-semibold">divide them across several pools</strong> using the number boxes on each
            line — the amounts must add up to your ticket total.{" "}
            <span className="font-semibold" style={{ color: accent }}>
              No purchase necessary
            </span>
            .
          </p>
          <p className="mt-3 text-pretty text-left text-[13px] leading-snug text-stone-600 dark:text-neutral-400">
            Each pool is drawn separately. Details are in the{" "}
            <Link
              href="/legal/rules#how-to-enter"
              className="font-semibold text-amber-800 underline decoration-amber-800/30 underline-offset-2 hover:underline dark:text-amber-300 dark:decoration-amber-300/30"
            >
              Official Rules
            </Link>
            .
          </p>
        </div>

        <form id="entry-form" onSubmit={onSubmit} className="space-y-6 sm:space-y-8">
          <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
            <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Your details</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
              Used only to contact winners. Same phone can&apos;t enter twice for this event.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-800 dark:text-neutral-200" htmlFor="entry-name">
                  Full name
                </label>
                <input
                  id="entry-name"
                  required
                  className="min-h-12 w-full touch-manipulation rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 shadow-inner outline-none ring-amber-500/30 placeholder:text-stone-400 focus:border-amber-500/50 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  enterKeyHint="next"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-800 dark:text-neutral-200" htmlFor="entry-phone">
                  Mobile number
                </label>
                <input
                  id="entry-phone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="min-h-12 w-full touch-manipulation rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 shadow-inner outline-none ring-amber-500/30 placeholder:text-stone-400 focus:border-amber-500/50 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  enterKeyHint="next"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-800 dark:text-neutral-200" htmlFor="entry-email">
                  Email
                </label>
                <input
                  id="entry-email"
                  required
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="min-h-12 w-full touch-manipulation rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 shadow-inner outline-none ring-amber-500/30 placeholder:text-stone-400 focus:border-amber-500/50 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  enterKeyHint="done"
                />
              </div>
            </div>
          </section>

          {newsletterShowsBonus || bonusRules.length > 0 ? (
          <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Boost your entry (optional)</h2>
                <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
                  {newsletterShowsBonus
                    ? `Get ${baseTickets} ticket${baseTickets === 1 ? "" : "s"} just for entering. Check the box below to join the email list and get +${newsletterBonus} immediately.`
                    : "Optional ways to stack tickets after the basics above."}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-stone-100 px-4 py-2 text-center dark:bg-neutral-800/90">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-500">Total now</p>
                <p className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-neutral-50">{previewTickets}</p>
                <p className="text-xs text-stone-500 dark:text-neutral-500">
                  ticket{previewTickets === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {newsletterShowsBonus ? (
              <label className="mt-5 flex min-h-[3.5rem] cursor-pointer items-start gap-4 rounded-2xl border border-stone-200/80 bg-white/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
                <input
                  type="checkbox"
                  className="mt-0.5 h-6 w-6 shrink-0 touch-manipulation rounded-md border-stone-300 text-amber-600 focus:ring-amber-500 dark:border-neutral-600 dark:bg-neutral-900"
                  checked={newsletterOptIn}
                  onChange={(e) => setNewsletterOptIn(e.target.checked)}
                />
                <span className="flex flex-1 flex-col">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-stone-900 dark:text-neutral-100">
                      Email me about new gear, restocks &amp; shop events
                    </span>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      +{newsletterBonus} ticket{newsletterBonus === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-neutral-400">
                    Checking this adds the bonus tickets to your entry now. Standard marketing unsubscribe applies.
                  </span>
                </span>
              </label>
            ) : null}

            {bonusRules.length > 0 ? (
            <div className="mt-5 space-y-5">
              {bonusRules.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-stone-200/80 bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/40"
                >
                  <BonusToggle
                    title={r.label}
                    description={r.description || "Optional — we may verify before awarding prizes."}
                    points={r.tickets}
                    checked={Boolean(bonusById[r.id])}
                    onChange={(v) => setBonus(r.id, v)}
                  />
                  {bonusById[r.id] ? (
                    <div className="border-t border-stone-200/80 px-4 pb-4 pt-3 dark:border-neutral-800">
                      {r.actionUrl ? (
                        <a
                          href={r.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-4 inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl border px-4 text-sm font-semibold text-stone-900 shadow-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                          style={{ borderColor: `${accent}66`, color: isDark ? "#fafaf9" : "#0c0a09" }}
                        >
                          {r.actionLabel ?? "Open link"}
                        </a>
                      ) : null}
                      {r.proofFields?.length ? (
                        <div className="space-y-4">
                          {r.proofFields.map((f) => (
                            <label key={f.id} className="block">
                              <span className="text-sm font-medium text-stone-800 dark:text-neutral-200">
                                {f.label}
                                {f.requiredWhenBonus ? (
                                  <span className="text-red-600 dark:text-red-400"> *</span>
                                ) : null}
                              </span>
                              {f.input === "textarea" ? (
                                <textarea
                                  className="mt-2 min-h-[5.5rem] w-full touch-manipulation rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                                  value={bonusProof[r.id]?.[f.id] ?? ""}
                                  onChange={(e) => updateProof(r.id, f.id, e.target.value)}
                                  placeholder={f.placeholder}
                                  autoComplete="off"
                                />
                              ) : (
                                <input
                                  type={f.input === "url" ? "url" : "text"}
                                  className="mt-2 min-h-12 w-full touch-manipulation rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                                  value={bonusProof[r.id]?.[f.id] ?? ""}
                                  onChange={(e) => updateProof(r.id, f.id, e.target.value)}
                                  placeholder={f.placeholder}
                                  autoComplete="off"
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            ) : null}
          </section>
          ) : null}

          <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Your tickets</h2>
                <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
                  Includes your base entry plus any extras you turned on. Use the number next to each pool to decide how
                  many tickets count in that drawing — whole numbers only, and they must add up to your total.
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-stone-100 px-4 py-3 dark:bg-neutral-800/90 sm:flex-col sm:items-center sm:py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-500">Total</p>
                <p className="text-3xl font-semibold tabular-nums text-stone-900 dark:text-neutral-50">{previewTickets}</p>
                <p className="text-xs text-stone-500 dark:text-neutral-500">tickets</p>
              </div>
            </div>

            {multiPool ? (
              <>
                <p
                  className={[
                    "mt-5 text-sm leading-relaxed tabular-nums",
                    assignedTotal === previewTickets
                      ? "text-stone-600 dark:text-neutral-400"
                      : "font-medium text-amber-900 dark:text-amber-100",
                  ].join(" ")}
                >
                  <span className="font-semibold text-stone-900 dark:text-neutral-100">{assignedTotal}</span> /{" "}
                  {previewTickets} tickets assigned
                  {selectedCount > 0 ? (
                    <>
                      {" "}
                      · {selectedCount} pool{selectedCount === 1 ? "" : "s"} with tickets
                    </>
                  ) : null}
                </p>
                <div className="mt-4 space-y-3" role="group" aria-label="Prize pools">
                  {event.raffles.map((r) => {
                    const n = poolTickets[r.id] ?? 0;
                    const cap = maxTicketsForPool(r.id, orderedIds, poolTickets, previewTickets);
                    const active = n > 0;
                    return (
                      <div
                        key={r.id}
                        className={[
                          "flex min-h-[5.5rem] touch-manipulation gap-4 rounded-2xl border p-4 sm:min-h-[5rem] sm:p-5",
                          active
                            ? "border-transparent ring-2 ring-offset-2 ring-offset-stone-50 dark:ring-offset-neutral-950"
                            : "border-stone-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-900/75",
                        ].join(" ")}
                        style={
                          active
                            ? ({
                                boxShadow: `0 12px 40px -16px ${accent}66`,
                                ["--tw-ring-color" as string]: accent,
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        <div className="relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-xl bg-stone-100 dark:bg-neutral-800">
                          {r.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div
                              className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
                              style={{ background: `linear-gradient(135deg, ${accent}, #1c1917)` }}
                            >
                              {r.title.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold leading-snug text-stone-900 dark:text-neutral-50">{r.title}</p>
                          {r.subtitle ? (
                            <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-neutral-400">{r.subtitle}</p>
                          ) : null}
                          {r.valueLabel?.trim() ? (
                            <p className="mt-2 text-xs font-semibold text-stone-600 dark:text-neutral-400">
                              <span style={{ color: accent }}>{r.valueLabel.trim()}</span>
                            </p>
                          ) : null}
                        </div>
                        <PoolTicketField
                          inputId={`pool-tickets-${r.id}`}
                          label={r.title}
                          value={n}
                          max={cap}
                          onCommit={(next) =>
                            setPoolTickets((prev) => ({
                              ...prev,
                              [r.id]: Math.max(
                                0,
                                Math.min(
                                  maxTicketsForPool(r.id, orderedIds, prev, previewTickets),
                                  Math.floor(next),
                                ),
                              ),
                            }))
                          }
                          inputClassName="h-11 w-[4.25rem] rounded-xl border border-stone-300 bg-white px-1.5 text-center text-base font-semibold tabular-nums text-stone-900 shadow-inner outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {!multiPool ? (
              <p className="mt-5 text-sm text-stone-600 dark:text-neutral-400">
                All <span className="font-semibold text-stone-900 dark:text-neutral-100">{previewTickets}</span> ticket
                {previewTickets === 1 ? "" : "s"} apply to this prize.
              </p>
            ) : null}

            {selectedCount === 1 && selectedPrize ? (
              <div
                className="mt-6 rounded-2xl border border-stone-200/90 p-4 sm:mt-8 sm:p-5 dark:border-neutral-700 dark:bg-neutral-950/30"
                style={{
                  boxShadow: isDark ? `0 0 0 1px ${accent}22` : `0 0 0 1px ${accent}18`,
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-neutral-500">
                  Your pick
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-stone-900 dark:text-neutral-50 sm:text-xl">
                  {selectedPrize.title}
                </h3>
                {selectedPrize.valueLabel?.trim() ? (
                  <p className="mt-2 text-base font-medium leading-snug text-stone-800 dark:text-neutral-200">
                    <span className="text-stone-500 dark:text-neutral-500">Could win for free: </span>
                    <span style={{ color: accent }}>{selectedPrize.valueLabel.trim()}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-stone-600 dark:text-neutral-400">No purchase necessary to win.</p>
                )}
              </div>
            ) : null}
          </section>

          {paidEnabled ? (
            <section
              className="rounded-3xl border border-amber-300/70 bg-amber-50/60 p-4 shadow-sm backdrop-blur dark:border-amber-500/30 dark:bg-amber-500/5 sm:p-6 md:p-8"
              aria-label="Buy extra raffle tickets"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">
                    Boost your odds (optional)
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
                    Buy extra tickets in any pool below — {formatMoney(priceCents, currency)} each.
                    After you submit, we&apos;ll send you to Stripe to pay. Your free entry is saved
                    either way, no purchase necessary.
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl bg-white/80 px-4 py-3 text-center shadow-inner dark:bg-neutral-900/80 sm:py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-500">
                    Cost
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-neutral-50">
                    {formatMoney(paidCostCents, currency)}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-neutral-500">
                    {paidTotal} ticket{paidTotal === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3" role="group" aria-label="Paid ticket pools">
                {event.raffles.map((r) => {
                  const n = paidPoolTickets[r.id] ?? 0;
                  const cap = maxTicketsForPool(r.id, orderedIds, paidPoolTickets, maxPerPurchase);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/85 p-3 dark:border-neutral-700 dark:bg-neutral-900/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-900 dark:text-neutral-100">
                          {r.title}
                        </p>
                        {r.subtitle ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-stone-600 dark:text-neutral-400">
                            {r.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <PoolTicketField
                        inputId={`paid-pool-tickets-${r.id}`}
                        label={`Buy tickets in ${r.title}`}
                        value={n}
                        max={cap}
                        onCommit={(next) =>
                          setPaidPoolTickets((prev) => ({
                            ...prev,
                            [r.id]: Math.max(
                              0,
                              Math.min(
                                maxTicketsForPool(r.id, orderedIds, prev, maxPerPurchase),
                                Math.floor(next),
                              ),
                            ),
                          }))
                        }
                        inputClassName="h-10 w-16 rounded-xl border border-stone-300 bg-white px-2 text-right text-sm font-semibold tabular-nums text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-amber-400 dark:focus:ring-amber-500/40"
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-stone-500 dark:text-neutral-500">
                Max {maxPerPurchase} tickets per checkout. Card details are handled by Stripe — we never see them.
              </p>
            </section>
          ) : null}

          {/* Honeypot */}
          <div className="hidden" aria-hidden="true">
            <label>
              Company
              <input
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
          </div>

          <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
            <label className="flex min-h-[3.25rem] cursor-pointer items-start gap-4 rounded-xl py-1">
              <input
                type="checkbox"
                className="mt-0.5 h-6 w-6 shrink-0 touch-manipulation rounded-md border-stone-300 text-amber-600 focus:ring-amber-500 dark:border-neutral-600 dark:bg-neutral-900"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              <span className="text-sm leading-relaxed text-stone-700 dark:text-neutral-300">
                I agree to the{" "}
                <Link
                  className="font-semibold text-amber-800 underline decoration-amber-800/40 underline-offset-2 dark:text-amber-300 dark:decoration-amber-300/40"
                  href="/legal/rules"
                >
                  Official Rules
                </Link>
                ,{" "}
                <Link
                  className="font-semibold text-amber-800 underline decoration-amber-800/40 underline-offset-2 dark:text-amber-300 dark:decoration-amber-300/40"
                  href="/legal/terms"
                >
                  Terms
                </Link>
                , and{" "}
                <Link
                  className="font-semibold text-amber-800 underline decoration-amber-800/40 underline-offset-2 dark:text-amber-300 dark:decoration-amber-300/40"
                  href="/legal/privacy"
                >
                  Privacy
                </Link>
                .
              </span>
            </label>
          </section>

          {message ? (
            <div
              role="status"
              className={[
                "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
                status === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                  : "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100",
              ].join(" ")}
            >
              {message}
            </div>
          ) : null}

          {status === "success" && entryToken && !testMode && event.paidTicketsEnabled && (event.ticketPriceCents ?? 0) > 0 ? (
            <BuyTicketsCard
              event={event}
              entryToken={entryToken}
              restrictToPoolIds={submittedPoolIds.length > 0 ? submittedPoolIds : undefined}
            />
          ) : null}

          {/* Spacer so content clears fixed submit bar on phones */}
          <div className="h-24 sm:h-20" aria-hidden />
        </form>

        <footer className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 px-2 pb-28 text-sm text-stone-500 dark:text-neutral-500 sm:mt-12 sm:pb-6 sm:text-xs md:pb-4">
          <Link
            href={`/e/${encodeURIComponent(event.slug)}/live`}
            className="min-h-11 touch-manipulation py-2 font-semibold hover:text-stone-800 dark:hover:text-neutral-200"
            style={{ color: accent }}
          >
            Live draw board
          </Link>
          <Link
            href="/legal/rules"
            className="min-h-11 touch-manipulation py-2 font-medium hover:text-stone-800 dark:hover:text-neutral-200"
          >
            Official rules
          </Link>
          <Link
            href="/legal/terms"
            className="min-h-11 touch-manipulation py-2 font-medium hover:text-stone-800 dark:hover:text-neutral-200"
          >
            Terms
          </Link>
          <Link
            href="/legal/privacy"
            className="min-h-11 touch-manipulation py-2 font-medium hover:text-stone-800 dark:hover:text-neutral-200"
          >
            Privacy
          </Link>
        </footer>
      </div>

      {/* Fixed primary action — thumb-friendly, respects home indicator */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-[var(--background)]/92 px-3 pt-3 backdrop-blur-md dark:border-neutral-800/80">
        <div className="pointer-events-auto mx-auto w-full max-w-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="submit"
            form="entry-form"
            disabled={status === "loading"}
            className="min-h-14 w-full touch-manipulation rounded-2xl text-base font-semibold text-white shadow-lg transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[3.25rem]"
            style={{ background: `linear-gradient(135deg, ${accent}, ${secondary})` }}
          >
            {status === "loading"
              ? paidEnabled && paidTotal > 0
                ? "Opening Stripe…"
                : "Submitting…"
              : paidEnabled && paidTotal > 0
                ? `Enter + pay ${formatMoney(paidCostCents, currency)}`
                : "Submit free entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

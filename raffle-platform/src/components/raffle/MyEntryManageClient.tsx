"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
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
import type { EventConfig, MyEntrySnapshot } from "@/lib/types";
import { BonusToggle } from "./BonusToggle";
import { PoolTicketField } from "./PoolTicketField";

type Props = {
  event: EventConfig;
  slug: string;
  /** From server `searchParams` when available. */
  initialToken?: string;
};

function formatDrawAt(iso: string): string {
  const t = String(iso || "").trim();
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function MyEntryManageClient({ event, slug, initialToken = "" }: Props) {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") || initialToken || "").trim();
  const urlTest = searchParams.get("test") === "1";
  const testMode = urlTest || event.defaultTestMode;

  const [entry, setEntry] = useState<MyEntrySnapshot | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const orderedIds = useMemo(() => event.raffles.map((r) => r.id), [event.raffles]);
  const [poolTickets, setPoolTickets] = useState<Record<string, number>>(() =>
    defaultPoolTickets(event.raffles.map((r) => r.id), 1),
  );
  const bonusRules = useMemo(() => resolveBonusRules(event), [event]);
  const [bonusById, setBonusById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bonusRules.map((r) => [r.id, false])),
  );
  const [bonusProof, setBonusProof] = useState<Record<string, Record<string, string>>>({});
  const [terms, setTerms] = useState(true);
  const [company, setCompany] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const accent = event.primaryColor || "#c9a227";
  const secondary = event.secondaryColor || "#1c1917";
  const isDark = event.theme === "dark";

  const applyEntryToForm = useCallback(
    (e: MyEntrySnapshot) => {
      setName(e.name);
      setEmail("");
      setPhone("");
      const ids = event.raffles.map((r) => r.id);
      const nextCounts = emptyPoolTickets(ids);
      for (const p of e.pools) {
        if (p.raffleId in nextCounts) nextCounts[p.raffleId] = Math.round(Number(p.tickets) || 0);
      }
      setPoolTickets(reconcilePoolTickets(ids, nextCounts, Math.round(e.totalTickets)));
      const rules = resolveBonusRules({ ...event, bonuses: e.bonuses ?? event.bonuses });
      const nextBonus: Record<string, boolean> = Object.fromEntries(rules.map((r) => [r.id, Boolean(e.bonusById[r.id])]));
      setBonusById(nextBonus);
      setBonusProof(e.bonusProof && typeof e.bonusProof === "object" ? { ...e.bonusProof } : {});
      setTerms(true);
    },
    [event],
  );

  useEffect(() => {
    if (!token) {
      setLoadStatus("error");
      setLoadMessage("This page needs the link from your confirmation email (missing token).");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadStatus("loading");
      setLoadMessage(null);
      try {
        const res = await fetch(
          `/api/entry/my?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
          { method: "GET", headers: { Accept: "application/json" } },
        );
        const data = (await res.json()) as { ok?: boolean; entry?: MyEntrySnapshot; error?: string; code?: string };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.entry) {
          setLoadStatus("error");
          setLoadMessage(data.error || "Could not load your entry.");
          return;
        }
        setEntry(data.entry);
        applyEntryToForm(data.entry);
        setLoadStatus("idle");
      } catch {
        if (!cancelled) {
          setLoadStatus("error");
          setLoadMessage("Network error loading your entry.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, token, applyEntryToForm]);

  const previewTickets = useMemo(
    () => computeTicketsFromBonuses(bonusById, bonusRules),
    [bonusById, bonusRules],
  );

  useEffect(() => {
    if (!entry) return;
    setPoolTickets((prev) => reconcilePoolTickets(orderedIds, prev, previewTickets));
  }, [entry, orderedIds, previewTickets]);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitMessage(null);
    if (!token || !entry || entry.editLocked) return;
    const poolSum = sumPoolTickets(orderedIds, poolTickets);
    if (countPositivePools(orderedIds, poolTickets) < 1) {
      setSubmitStatus("error");
      setSubmitMessage("Give at least one ticket to a prize pool.");
      return;
    }
    if (poolSum !== previewTickets) {
      setSubmitStatus("error");
      setSubmitMessage(
        `Tickets per pool must add up to ${previewTickets} (you have ${poolSum} assigned). Adjust the numbers next to each pool.`,
      );
      return;
    }
    if (!terms) {
      setSubmitStatus("error");
      setSubmitMessage("Please accept the official rules and terms.");
      return;
    }
    const proofErr = validateBonusProof(bonusProof, bonusRules, bonusById);
    if (proofErr) {
      setSubmitStatus("error");
      setSubmitMessage(proofErr);
      return;
    }
    setSubmitStatus("loading");
    try {
      const baseBody: Record<string, unknown> = {
        slug,
        token,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        bonusById,
        bonusInstagram: Boolean(bonusById.instagram),
        bonusReview: Boolean(bonusById.review),
        bonusReferral: Boolean(bonusById.referral),
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

      const res = await fetch("/api/entry/my", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        totalEntries?: number;
        poolsEntered?: number;
        error?: string;
        code?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setSubmitStatus("error");
        setSubmitMessage(data.error || "Update failed.");
        return;
      }
      setSubmitStatus("success");
      const splitNote =
        selectedIdsOrdered.length > 1 && typeof data.poolsEntered === "number"
          ? ` Tickets split across ${data.poolsEntered} pool${data.poolsEntered === 1 ? "" : "s"}.`
          : "";
      setSubmitMessage(data.message || `Saved. ${data.totalEntries ?? previewTickets} total tickets.${splitNote}`);
      const reload = await fetch(
        `/api/entry/my?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
        { method: "GET", headers: { Accept: "application/json" } },
      );
      const reloadJson = (await reload.json()) as { ok?: boolean; entry?: MyEntrySnapshot };
      if (reloadJson.ok && reloadJson.entry) {
        setEntry(reloadJson.entry);
        applyEntryToForm(reloadJson.entry);
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMessage("Network error. Try again.");
    }
  }

  const locked = Boolean(entry?.editLocked);
  const last4 = entry?.phoneLast4 ?? "";

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
          ) : null}
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-stone-900 dark:text-neutral-50 sm:text-3xl">
            Your entry
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-neutral-400">{event.name}</p>
        </header>

        {loadStatus === "loading" ? (
          <p className="text-center text-sm text-stone-600 dark:text-neutral-400">Loading your tickets…</p>
        ) : null}

        {loadStatus === "error" && loadMessage ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-900 dark:text-red-100">
            {loadMessage}
            <p className="mt-3 text-xs text-red-800/90 dark:text-red-200/90">
              Open the link from your email, or return to the{" "}
              <Link href={`/e/${encodeURIComponent(slug)}`} className="font-semibold underline underline-offset-2">
                entry page
              </Link>
              .
            </p>
          </div>
        ) : null}

        {entry ? (
          <>
            {locked ? (
              <div
                className="mb-6 rounded-2xl border px-4 py-3 text-sm"
                style={{ borderColor: `${accent}55`, background: `${accent}12` }}
              >
                Changes are closed — at least one of your pools is within 10 minutes of its scheduled draw (or the
                event has locked edits). You can still review your details below.
              </div>
            ) : (
              <p className="mb-6 text-center text-sm text-stone-600 dark:text-neutral-400">
                Re-enter the same name, email, and phone you used to enter, then adjust pools or extras and save.
              </p>
            )}

            <div className="mb-6 rounded-2xl border border-stone-200 bg-white/80 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/80">
              <p className="font-medium text-stone-900 dark:text-neutral-100">
                {entry.totalTickets} ticket{entry.totalTickets === 1 ? "" : "s"} · {entry.emailMasked}
                {last4 ? ` · phone …${last4}` : null}
              </p>
              <ul className="mt-3 space-y-2 text-stone-700 dark:text-neutral-300">
                {entry.pools.map((p) => (
                  <li key={p.raffleId} className="flex flex-wrap justify-between gap-2 border-t border-stone-100 pt-2 first:border-t-0 first:pt-0 dark:border-neutral-800">
                    <span>{p.title}</span>
                    <span className="tabular-nums text-stone-600 dark:text-neutral-400">
                      {p.tickets} in pool
                      {p.drawAt ? (
                        <span className="ml-2 block text-xs sm:inline sm:ml-2">
                          · draw {formatDrawAt(p.drawAt)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <form id="my-entry-form" onSubmit={onSubmit} className="space-y-6 sm:space-y-8">
              <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
                <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">
                  Confirm it&apos;s you
                </h2>
                <p className="mt-1 text-sm text-stone-600 dark:text-neutral-400">
                  Must match exactly what we have on file for this link.
                </p>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-800 dark:text-neutral-200" htmlFor="my-name">
                      Full name
                    </label>
                    <input
                      id="my-name"
                      required
                      disabled={locked}
                      className="min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 outline-none disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-800 dark:text-neutral-200" htmlFor="my-phone">
                      Mobile number
                    </label>
                    <input
                      id="my-phone"
                      required
                      disabled={locked}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 outline-none disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={last4 ? `Same number (ends …${last4})` : "Same number you entered with"}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-800 dark:text-neutral-200" htmlFor="my-email">
                      Email
                    </label>
                    <input
                      id="my-email"
                      required
                      disabled={locked}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      className="min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 outline-none disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Full address (same as when you entered)"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Extra entries</h2>
                    <p className="mt-1 text-sm text-stone-600 dark:text-neutral-400">
                      Optional ticket multipliers — same as on the main entry form.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-stone-100 px-4 py-2 text-center dark:bg-neutral-800/90">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-500">Total</p>
                    <p className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-neutral-50">{previewTickets}</p>
                  </div>
                </div>
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
                        disabled={locked}
                      />
                      {bonusById[r.id] && !locked ? (
                        <div className="border-t border-stone-200/80 px-4 pb-4 pt-3 dark:border-neutral-800">
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
                                      className="mt-2 min-h-[5.5rem] w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                                      value={bonusProof[r.id]?.[f.id] ?? ""}
                                      onChange={(e) => updateProof(r.id, f.id, e.target.value)}
                                      placeholder={f.placeholder}
                                      autoComplete="off"
                                    />
                                  ) : (
                                    <input
                                      type={f.input === "url" ? "url" : "text"}
                                      className="mt-2 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
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
              </section>

              {multiPool ? (
                <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
                  <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Ticket split</h2>
                  <p className="mt-1 text-sm text-stone-600 dark:text-neutral-400">
                    Set how many of your tickets count in each pool. Counts must add up to your total; use 0 to skip a
                    pool.
                  </p>
                  <p
                    className={[
                      "mt-3 text-sm tabular-nums",
                      assignedTotal === previewTickets
                        ? "text-stone-600 dark:text-neutral-400"
                        : "font-medium text-amber-900 dark:text-amber-100",
                    ].join(" ")}
                  >
                    <span className="font-semibold text-stone-900 dark:text-neutral-100">{assignedTotal}</span> /{" "}
                    {previewTickets} assigned
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
                            "flex min-h-[5.5rem] gap-4 rounded-2xl border p-4 sm:min-h-[5rem] sm:p-5",
                            locked ? "opacity-60" : "",
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
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-bold text-stone-900 dark:text-neutral-50">{r.title}</p>
                            {r.drawAt ? (
                              <p className="mt-1 text-xs text-stone-500 dark:text-neutral-500">
                                Scheduled draw: {formatDrawAt(r.drawAt)}
                              </p>
                            ) : null}
                          </div>
                          <PoolTicketField
                            inputId={`my-pool-${r.id}`}
                            label={r.title}
                            value={n}
                            max={cap}
                            disabled={locked}
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
                            inputClassName="h-11 w-[4.25rem] rounded-xl border border-stone-300 bg-white px-1.5 text-center text-base font-semibold tabular-nums text-stone-900 shadow-inner outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30 disabled:cursor-not-allowed dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                          />
                        </div>
                      );
                    })}
                  </div>
                  {selectedCount === 1 && selectedPrize ? (
                    <p className="mt-4 text-sm text-stone-600 dark:text-neutral-400">
                      All tickets apply to <strong className="text-stone-900 dark:text-neutral-100">{selectedPrize.title}</strong>.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <div className="hidden" aria-hidden="true">
                <label>
                  Company
                  <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
                </label>
              </div>

              <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
                <label className="flex min-h-[3.25rem] cursor-pointer items-start gap-4 rounded-xl py-1">
                  <input
                    type="checkbox"
                    disabled={locked}
                    className="mt-0.5 h-6 w-6 shrink-0 rounded-md border-stone-300 text-amber-600 focus:ring-amber-500 dark:border-neutral-600 dark:bg-neutral-900"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                  />
                  <span className="text-sm leading-relaxed text-stone-700 dark:text-neutral-300">
                    I agree to the{" "}
                    <Link className="font-semibold text-amber-800 underline dark:text-amber-300" href="/legal/rules">
                      Official Rules
                    </Link>
                    ,{" "}
                    <Link className="font-semibold text-amber-800 underline dark:text-amber-300" href="/legal/terms">
                      Terms
                    </Link>
                    , and{" "}
                    <Link className="font-semibold text-amber-800 underline dark:text-amber-300" href="/legal/privacy">
                      Privacy
                    </Link>
                    .
                  </span>
                </label>
              </section>

              {submitMessage ? (
                <div
                  role="status"
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
                    submitStatus === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                      : "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100",
                  ].join(" ")}
                >
                  {submitMessage}
                </div>
              ) : null}

              <div className="h-24 sm:h-20" aria-hidden />
            </form>
          </>
        ) : null}

        <footer className="mt-10 pb-28 text-center text-sm text-stone-500 dark:text-neutral-500 sm:pb-8">
          <Link href={`/e/${encodeURIComponent(slug)}`} className="font-medium underline underline-offset-2">
            Back to entry page
          </Link>
        </footer>
      </div>

      {entry && !locked ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-[var(--background)]/92 px-3 pt-3 backdrop-blur-md dark:border-neutral-800/80">
          <div className="pointer-events-auto mx-auto w-full max-w-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              form="my-entry-form"
              disabled={submitStatus === "loading" || loadStatus === "loading"}
              className="min-h-14 w-full touch-manipulation rounded-2xl text-base font-semibold text-white shadow-lg transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[3.25rem]"
              style={{ background: `linear-gradient(135deg, ${accent}, ${secondary})` }}
            >
              {submitStatus === "loading" ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

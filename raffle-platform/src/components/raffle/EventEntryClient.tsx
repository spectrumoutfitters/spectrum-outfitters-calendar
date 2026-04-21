"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import type { EventConfig } from "@/lib/types";
import { trimBonusProofForSubmit, validateBonusProof } from "@/lib/bonusProof";
import { computeTicketsFromBonuses, resolveBonusRules } from "@/lib/entryMath";
import { BonusToggle } from "./BonusToggle";

type Props = {
  event: EventConfig;
};

/** Even split share for display (e.g. 1 ticket ÷ 4 pools → 0.25). */
function formatTicketSlice(total: number, pools: number): string {
  if (pools < 1) return "—";
  const v = total / pools;
  if (Number.isInteger(v)) return String(v);
  const s = v.toFixed(6);
  return s.replace(/\.?0+$/, "");
}

export function EventEntryClient({ event }: Props) {
  const searchParams = useSearchParams();
  const urlTest = searchParams.get("test") === "1";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  /** Which prize pool(s) get tickets — at least one must stay on. Order follows event list for API. */
  const [poolSelected, setPoolSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = Object.fromEntries(event.raffles.map((r) => [r.id, false]));
    if (event.raffles[0]) init[event.raffles[0].id] = true;
    return init;
  });
  const bonusRules = useMemo(() => resolveBonusRules(event), [event]);
  const [bonusById, setBonusById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bonusRules.map((r) => [r.id, false])),
  );
  const [bonusProof, setBonusProof] = useState<Record<string, Record<string, string>>>({});
  const [terms, setTerms] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const testMode = urlTest || event.defaultTestMode;

  const accent = event.primaryColor || "#c9a227";
  const secondary = event.secondaryColor || "#1c1917";

  const previewTickets = useMemo(
    () => computeTicketsFromBonuses(bonusById, bonusRules),
    [bonusById, bonusRules],
  );

  const selectedIdsOrdered = useMemo(
    () => event.raffles.map((r) => r.id).filter((id) => poolSelected[id]),
    [event.raffles, poolSelected],
  );
  const selectedCount = selectedIdsOrdered.length;

  const selectedPrize = useMemo(
    () => (selectedCount === 1 ? (event.raffles.find((r) => r.id === selectedIdsOrdered[0]) ?? null) : null),
    [event.raffles, selectedCount, selectedIdsOrdered],
  );

  const multiPool = event.raffles.length >= 2;

  function togglePool(id: string) {
    setPoolSelected((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const on = Object.values(next).filter(Boolean).length;
      if (on === 0) return prev;
      return next;
    });
  }

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
    if (selectedIdsOrdered.length === 0) {
      setStatus("error");
      setMessage("Choose at least one prize pool.");
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
        company,
        termsAccepted: terms,
        testMode,
      };
      const trimmedProof = trimBonusProofForSubmit(bonusProof, bonusRules);
      if (Object.keys(trimmedProof).length) baseBody.bonusProof = trimmedProof;

      if (selectedIdsOrdered.length === 1) {
        baseBody.ticketMode = "single";
        baseBody.raffleId = selectedIdsOrdered[0];
      } else {
        baseBody.ticketMode = "split";
        baseBody.splitEvenly = true;
        baseBody.splitRaffleIds = selectedIdsOrdered;
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
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setStatus("success");
      const splitNote =
        selectedIdsOrdered.length > 1 && typeof data.poolsEntered === "number"
          ? ` Split evenly across ${data.poolsEntered} prize pool${data.poolsEntered === 1 ? "" : "s"}.`
          : "";
      setMessage(
        data.message ||
          (testMode
            ? `Test entry recorded (${data.totalEntries ?? previewTickets} tickets).${splitNote}`
            : `You’re in! ${data.totalEntries ?? previewTickets} total tickets.${splitNote}`),
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
            One submission per phone. Choose <strong className="font-semibold">one</strong> prize pool for all your tickets,
            or check <strong className="font-semibold">several</strong> pools — your tickets are then{" "}
            <strong className="font-semibold">split evenly</strong> only across the pools you picked (fractions allowed,
            e.g. 1 ticket across 4 pools = 0.25 each).{" "}
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

          <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Extra entries</h2>
                <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
                  Optional ways to stack tickets after the basics above. We save @handles and links so our team can verify
                  follows, tags, and reviews before prizes — this form does not log into Instagram or Facebook for you.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-stone-100 px-4 py-2 text-center dark:bg-neutral-800/90">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-500">Total now</p>
                <p className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-neutral-50">{previewTickets}</p>
                <p className="text-xs text-stone-500 dark:text-neutral-500">tickets</p>
              </div>
            </div>
            <div className="mt-5 space-y-5">
              {bonusRules.map((r) => (
                <div
                  key={r.id}
                  className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/40"
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
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Your tickets</h2>
                <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
                  Includes your base entry plus any extras you turned on. Check every pool you want a chance in — one pool
                  gets all tickets; several pools split your total <span className="font-medium">evenly</span> across only
                  those lines.
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
                <p className="mt-5 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
                  <span className="font-semibold text-stone-900 dark:text-neutral-100">{selectedCount}</span> pool
                  {selectedCount === 1 ? "" : "s"} selected
                  {selectedCount >= 2 ? (
                    <>
                      {" "}
                      — even split:{" "}
                      <span className="font-semibold tabular-nums text-stone-900 dark:text-neutral-100">
                        {formatTicketSlice(previewTickets, selectedCount)}
                      </span>{" "}
                      of your total per selected pool.
                    </>
                  ) : (
                    <> — all {previewTickets} ticket{previewTickets === 1 ? "" : "s"} count in that drawing.</>
                  )}
                </p>
                <div className="mt-4 space-y-3" role="group" aria-label="Prize pools">
                  {event.raffles.map((r) => {
                    const checked = Boolean(poolSelected[r.id]);
                    const slice =
                      selectedCount >= 2 && checked ? formatTicketSlice(previewTickets, selectedCount) : null;
                    return (
                      <label
                        key={r.id}
                        className={[
                          "flex min-h-[5.5rem] cursor-pointer touch-manipulation gap-4 rounded-2xl border p-4 transition sm:min-h-[5rem] sm:p-5",
                          checked
                            ? "border-transparent ring-2 ring-offset-2 ring-offset-stone-50 dark:ring-offset-neutral-950"
                            : "border-stone-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-900/75",
                        ].join(" ")}
                        style={
                          checked
                            ? ({
                                boxShadow: `0 12px 40px -16px ${accent}66`,
                                ["--tw-ring-color" as string]: accent,
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePool(r.id)}
                          className="mt-1 h-6 w-6 shrink-0 rounded-md border-stone-300 text-amber-600 focus:ring-amber-500 dark:border-neutral-600 dark:bg-neutral-900"
                        />
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
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-base font-bold leading-snug text-stone-900 dark:text-neutral-50">{r.title}</p>
                            {slice != null ? (
                              <span
                                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums text-stone-900 dark:text-neutral-50"
                                style={{
                                  backgroundColor: `${accent}22`,
                                  border: `1px solid ${accent}55`,
                                }}
                              >
                                {slice} each
                              </span>
                            ) : null}
                          </div>
                          {r.subtitle ? (
                            <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-neutral-400">{r.subtitle}</p>
                          ) : null}
                          {r.valueLabel?.trim() ? (
                            <p className="mt-2 text-xs font-semibold text-stone-600 dark:text-neutral-400">
                              <span style={{ color: accent }}>{r.valueLabel.trim()}</span>
                            </p>
                          ) : null}
                        </div>
                      </label>
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

          {/* Spacer so content clears fixed submit bar on phones */}
          <div className="h-24 sm:h-20" aria-hidden />
        </form>

        <footer className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 px-2 pb-28 text-sm text-stone-500 dark:text-neutral-500 sm:mt-12 sm:pb-6 sm:text-xs md:pb-4">
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
            {status === "loading" ? "Submitting…" : "Submit free entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

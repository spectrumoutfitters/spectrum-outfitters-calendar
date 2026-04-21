"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EventConfig } from "@/lib/types";
import { computeTicketsFromBonuses, resolveBonusRules } from "@/lib/entryMath";
import { BonusToggle } from "./BonusToggle";
import { RaffleCard } from "./RaffleCard";

type Props = {
  event: EventConfig;
};

export function EventEntryClient({ event }: Props) {
  const searchParams = useSearchParams();
  const urlTest = searchParams.get("test") === "1";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [raffleId, setRaffleId] = useState(event.raffles[0]?.id ?? "");
  /** "one" = single pool (default). "every" = split tickets across all active pools. */
  const [poolChoice, setPoolChoice] = useState<"one" | "every">("one");
  const [showCustomSplit, setShowCustomSplit] = useState(false);
  const [splitShares, setSplitShares] = useState<Record<string, number>>({});
  const bonusRules = useMemo(() => resolveBonusRules(event), [event]);
  const [bonusById, setBonusById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bonusRules.map((r) => [r.id, false])),
  );
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

  const selectedPrize = useMemo(
    () => event.raffles.find((r) => r.id === raffleId) ?? null,
    [event.raffles, raffleId],
  );

  const canSplitAcrossPools = event.raffles.length >= 2;

  useEffect(() => {
    setSplitShares(Object.fromEntries(event.raffles.map((r) => [r.id, 1])));
  }, [event.raffles]);

  useEffect(() => {
    if (!canSplitAcrossPools && poolChoice === "every") setPoolChoice("one");
  }, [canSplitAcrossPools, poolChoice]);

  function setBonus(id: string, v: boolean) {
    setBonusById((prev) => ({ ...prev, [id]: v }));
  }

  const isDark = event.theme === "dark";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (poolChoice === "one" && !raffleId) {
      setStatus("error");
      setMessage("Choose a prize.");
      return;
    }
    if (!terms) {
      setStatus("error");
      setMessage("Please accept the official rules and terms.");
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

      if (poolChoice === "one") {
        baseBody.ticketMode = "single";
        baseBody.raffleId = raffleId;
      } else if (!showCustomSplit) {
        baseBody.ticketMode = "split";
        baseBody.splitEvenly = true;
        baseBody.raffleId = event.raffles[0]?.id ?? "";
      } else {
        const ids = event.raffles.map((r) => r.id);
        const raw = Object.fromEntries(ids.map((id) => [id, Math.max(0, Number(splitShares[id]) || 0)]));
        const sum = ids.reduce((s, id) => s + (raw[id] as number), 0);
        baseBody.ticketMode = "split";
        if (sum <= 0) {
          baseBody.splitEvenly = true;
          baseBody.raffleId = event.raffles[0]?.id ?? "";
        } else {
          baseBody.splitEvenly = false;
          const ticketSplit: Record<string, number> = {};
          for (const id of ids) {
            ticketSplit[id] = ((raw[id] as number) / sum) * previewTickets;
          }
          baseBody.ticketSplit = ticketSplit;
          baseBody.raffleId = event.raffles[0]?.id ?? "";
        }
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
        poolChoice === "every" && typeof data.poolsEntered === "number"
          ? ` Split across ${data.poolsEntered} prize pools.`
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
          <div className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {event.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.logoUrl} alt="" className="max-h-full max-w-full object-contain p-2" />
            ) : (
              <span
                className="grid h-full w-full place-items-center text-2xl font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${secondary})`,
                }}
              >
                {event.name.slice(0, 1)}
              </span>
            )}
          </div>
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
            One submission per phone. Put all your tickets on <strong className="font-semibold">one</strong> prize, or share
            them across <strong className="font-semibold">every</strong> pool for a shot at each drawing —{" "}
            <span className="font-semibold" style={{ color: accent }}>
              no purchase necessary
            </span>
            .
          </p>
          <p className="mt-3 text-pretty text-left text-[13px] leading-snug text-stone-600 dark:text-neutral-400">
            Splitting divides your total tickets (including bonuses) across pools. How that works is spelled out in the{" "}
            <Link
              href="/legal/rules#how-to-enter"
              className="font-semibold text-amber-800 underline decoration-amber-800/30 underline-offset-2 hover:underline dark:text-amber-300 dark:decoration-amber-300/30"
            >
              Official Rules (§4)
            </Link>
            . Each pool is drawn separately.
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Your tickets</h2>
                <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
                  Includes your base entry plus any bonuses you turn on below. Choose how those tickets count toward prizes.
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-stone-100 px-4 py-3 dark:bg-neutral-800/90 sm:flex-col sm:items-center sm:py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-500">Total</p>
                <p className="text-3xl font-semibold tabular-nums text-stone-900 dark:text-neutral-50">{previewTickets}</p>
                <p className="text-xs text-stone-500 dark:text-neutral-500">tickets</p>
              </div>
            </div>

            {canSplitAcrossPools ? (
              <div
                className="mt-6 flex flex-col gap-1.5 rounded-2xl border border-stone-200/80 bg-stone-50/90 p-1.5 dark:border-neutral-700 dark:bg-neutral-950/80 sm:flex-row sm:gap-1"
                role="tablist"
                aria-label="How to use your tickets"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={poolChoice === "one"}
                  onClick={() => {
                    setPoolChoice("one");
                    setShowCustomSplit(false);
                  }}
                  className={[
                    "min-h-[3rem] flex-1 touch-manipulation rounded-xl px-4 py-3 text-center text-sm font-semibold transition sm:min-h-[2.75rem]",
                    poolChoice === "one"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-stone-600 dark:text-neutral-500",
                  ].join(" ")}
                >
                  One prize · all tickets here
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={poolChoice === "every"}
                  onClick={() => setPoolChoice("every")}
                  className={[
                    "min-h-[3rem] flex-1 touch-manipulation rounded-xl px-4 py-3 text-center text-sm font-semibold transition sm:min-h-[2.75rem]",
                    poolChoice === "every"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-stone-600 dark:text-neutral-500",
                  ].join(" ")}
                >
                  Every pool · tickets split
                </button>
              </div>
            ) : null}

            {poolChoice === "one" ? (
              <>
                <p className="mt-5 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
                  Tap a card — big touch targets, easy on phones.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {event.raffles.map((r) => (
                    <RaffleCard
                      key={r.id}
                      raffle={r}
                      selected={raffleId === r.id}
                      onSelect={setRaffleId}
                      accent={accent}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-stone-200/80 bg-stone-50/50 px-4 py-5 dark:border-neutral-700 dark:bg-neutral-950/40">
                <p className="text-sm leading-relaxed text-stone-700 dark:text-neutral-300">
                  Your <span className="font-semibold text-stone-900 dark:text-white">{previewTickets}</span> tickets are divided
                  across <span className="font-semibold">{event.raffles.length}</span> drawings (equal by default). You stay one
                  entrant; each pool only counts its slice of your tickets.
                </p>
                <ul className="mt-4 space-y-2.5 text-sm text-stone-600 dark:text-neutral-400">
                  {event.raffles.map((r) => (
                    <li key={r.id} className="flex items-center gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} aria-hidden />
                      <span className="font-medium text-stone-800 dark:text-neutral-200">{r.title}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setShowCustomSplit((v) => !v)}
                  className="mt-5 min-h-11 touch-manipulation text-left text-sm font-semibold text-amber-800 underline decoration-amber-800/40 underline-offset-2 dark:text-amber-300 dark:decoration-amber-300/40"
                >
                  {showCustomSplit ? "Use equal split instead" : "Custom split (optional)"}
                </button>
                {showCustomSplit ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-white/90 p-4 dark:border-neutral-700 dark:bg-neutral-900/80">
                    <p className="text-xs leading-relaxed text-stone-500 dark:text-neutral-500">
                      Enter positive weights — we scale them to your {previewTickets} tickets. See rules for how draws use
                      splits.
                    </p>
                    {event.raffles.map((r) => (
                      <label key={r.id} className="flex min-h-12 items-center gap-3 text-sm">
                        <span className="min-w-0 flex-1 font-medium text-stone-800 dark:text-neutral-200">{r.title}</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          inputMode="decimal"
                          className="min-h-12 w-[6.5rem] shrink-0 touch-manipulation rounded-xl border border-stone-200 bg-white px-3 text-right text-base tabular-nums text-stone-900 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                          value={splitShares[r.id] ?? 0}
                          onChange={(e) =>
                            setSplitShares((prev) => ({
                              ...prev,
                              [r.id]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {poolChoice === "one" && selectedPrize ? (
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

          <section className="rounded-3xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-6 md:p-8">
            <h2 className="text-base font-semibold text-stone-900 dark:text-neutral-100 sm:text-lg">Bonus tickets</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-neutral-400">
              Optional — we may verify before prizes are awarded.
            </p>
            <div className="mt-5 space-y-2 sm:space-y-3">
              {bonusRules.map((r) => (
                <BonusToggle
                  key={r.id}
                  title={r.label}
                  description={r.description || "We may verify before awarding prizes."}
                  points={r.tickets}
                  checked={Boolean(bonusById[r.id])}
                  onChange={(v) => setBonus(r.id, v)}
                />
              ))}
            </div>
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

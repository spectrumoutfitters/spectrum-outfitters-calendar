"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EventConfig } from "@/lib/types";
import { BONUS_WEIGHTS, computeTicketCount } from "@/lib/entryMath";
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
  const [ig, setIg] = useState(false);
  const [review, setReview] = useState(false);
  const [referral, setReferral] = useState(false);
  const [terms, setTerms] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const testMode = urlTest || event.defaultTestMode;

  const accent = event.primaryColor || "#c9a227";
  const secondary = event.secondaryColor || "#1c1917";

  const previewTickets = useMemo(
    () => computeTicketCount({ bonusInstagram: ig, bonusReview: review, bonusReferral: referral }),
    [ig, review, referral],
  );

  const isDark = event.theme === "dark";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!raffleId) {
      setStatus("error");
      setMessage("Choose a raffle.");
      return;
    }
    if (!terms) {
      setStatus("error");
      setMessage("Please accept the official rules and terms.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: event.slug,
          name,
          phone,
          email,
          raffleId,
          bonusInstagram: ig,
          bonusReview: review,
          bonusReferral: referral,
          company,
          termsAccepted: terms,
          testMode,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        totalEntries?: number;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setStatus("success");
      setMessage(
        data.message ||
          (testMode
            ? `Test entry recorded (${data.totalEntries ?? previewTickets} tickets).`
            : `You’re in! ${data.totalEntries ?? previewTickets} tickets in the drum.`),
      );
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <div
      className={[
        "min-h-screen bg-[var(--background)] text-[var(--foreground)]",
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
      <div className="mx-auto max-w-screen-md px-4 pb-16 pt-10 md:px-6 lg:max-w-3xl lg:px-8 lg:pt-14">
        <header className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {event.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.logoUrl} alt="" className="max-h-full max-w-full object-contain p-2" />
            ) : (
              <span
                className="text-2xl font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${secondary})`,
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {event.name.slice(0, 1)}
              </span>
            )}
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-stone-900 dark:text-neutral-50 md:text-4xl">
            {event.name}
          </h1>
          {event.description ? (
            <p className="mt-3 max-w-prose text-pretty text-base text-stone-600 dark:text-neutral-400">
              {event.description}
            </p>
          ) : null}
          {testMode ? (
            <div className="mt-4 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
              Test mode on — entries are flagged (and may be blocked by sheet settings)
            </div>
          ) : null}
        </header>

        <form onSubmit={onSubmit} className="space-y-8">
          <section className="rounded-3xl border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 md:p-8">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-neutral-100">Your details</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-neutral-400">
              We use this to contact winners. One entry per phone number.
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-800 dark:text-neutral-200">
                  Full name
                </label>
                <input
                  required
                  className="h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-base text-stone-900 shadow-inner outline-none ring-amber-500/30 placeholder:text-stone-400 focus:border-amber-500/50 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-800 dark:text-neutral-200">
                  Phone
                </label>
                <input
                  required
                  type="tel"
                  className="h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-base text-stone-900 shadow-inner outline-none ring-amber-500/30 placeholder:text-stone-400 focus:border-amber-500/50 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-800 dark:text-neutral-200">
                  Email
                </label>
                <input
                  required
                  type="email"
                  className="h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-base text-stone-900 shadow-inner outline-none ring-amber-500/30 placeholder:text-stone-400 focus:border-amber-500/50 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 md:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 dark:text-neutral-100">Pick your raffle</h2>
                <p className="mt-1 text-sm text-stone-600 dark:text-neutral-400">
                  Select the prize pool you want to join.
                </p>
              </div>
              <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 dark:bg-neutral-800 dark:text-neutral-200">
                {previewTickets} tickets if submitted now
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 md:p-8">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-neutral-100">Bonus tickets</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-neutral-400">
              Complete any bonus — we may verify before awarding prizes.
            </p>
            <div className="mt-6 space-y-3">
              <BonusToggle
                title="Instagram follow or story mention"
                description="Follow us and tag the shop — quick visibility boost."
                points={BONUS_WEIGHTS.instagram}
                checked={ig}
                onChange={setIg}
              />
              <BonusToggle
                title="Leave a review"
                description="Google or Facebook review for the business."
                points={BONUS_WEIGHTS.review}
                checked={review}
                onChange={setReview}
              />
              <BonusToggle
                title="Refer a friend"
                description="Friend must mention your name on their entry."
                points={BONUS_WEIGHTS.referral}
                checked={referral}
                onChange={setReferral}
              />
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

          <section className="rounded-3xl border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 md:p-8">
            <label className="flex min-h-12 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500 dark:border-neutral-600 dark:bg-neutral-900"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              <span className="text-sm text-stone-700 dark:text-neutral-300">
                I agree to the{" "}
                <Link className="font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-300" href="/legal/rules">
                  Official Rules
                </Link>
                ,{" "}
                <Link className="font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-300" href="/legal/terms">
                  Terms
                </Link>
                , and{" "}
                <Link className="font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-300" href="/legal/privacy">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </section>

          {message ? (
            <div
              className={[
                "rounded-2xl border px-4 py-3 text-sm",
                status === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                  : "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100",
              ].join(" ")}
            >
              {message}
            </div>
          ) : null}

          <div className="sticky bottom-4 z-10 pt-2">
            <button
              type="submit"
              disabled={status === "loading"}
              className="h-14 w-full rounded-2xl text-base font-semibold text-white shadow-lg transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${accent}, ${secondary})` }}
            >
              {status === "loading" ? "Submitting…" : "Submit my entry"}
            </button>
          </div>
        </form>

        <footer className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-stone-500 dark:text-neutral-500">
          <Link href="/legal/rules" className="hover:text-stone-800 dark:hover:text-neutral-200">
            Official rules
          </Link>
          <Link href="/legal/terms" className="hover:text-stone-800 dark:hover:text-neutral-200">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-stone-800 dark:hover:text-neutral-200">
            Privacy
          </Link>
        </footer>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventConfig, PublicWinnerRow, PublicWinnersFeedResponse } from "@/lib/types";

type Phase = "waiting" | "revealing" | "winner";

type Props = {
  slug: string;
  event: EventConfig;
};

const PLACEHOLDER_TICKERS = [
  "Mixing the drum…",
  "Counting tickets…",
  "Good luck everyone…",
  "Almost there…",
  "Selecting from the pool…",
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

function ConfettiBurst({ active, accent }: { active: boolean; accent: string }) {
  if (!active) return null;
  const pieces = 18;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {Array.from({ length: pieces }).map((_, i) => {
        const left = `${(i * 37 + 11) % 100}%`;
        const delay = `${(i % 5) * 0.05}s`;
        const dur = `${1.2 + (i % 4) * 0.15}s`;
        const rot = `${(i * 47) % 360}deg`;
        return (
          <span
            key={i}
            className="confetti-piece absolute top-[-10%] h-2 w-2 rounded-sm opacity-90"
            style={{
              left,
              backgroundColor: i % 3 === 0 ? accent : i % 3 === 1 ? "#f5f5f4" : "#fbbf24",
              animation: `confetti-fall ${dur} ease-in ${delay} forwards`,
              transform: `rotate(${rot})`,
            }}
          />
        );
      })}
      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0.35;
          }
        }
      `}</style>
    </div>
  );
}

export function LiveDrawBoardClient({ slug, event }: Props) {
  const accent = event.primaryColor || "#c9a227";
  const secondary = event.secondaryColor || "#1c1917";
  const isDark = event.theme !== "light";
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState<Phase>("waiting");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [winners, setWinners] = useState<PublicWinnerRow[]>([]);
  const [revealTicker, setRevealTicker] = useState(0);
  const [highlightWinner, setHighlightWinner] = useState<PublicWinnerRow | null>(null);
  const [cheerBurst, setCheerBurst] = useState(0);
  const [revealConfetti, setRevealConfetti] = useState(false);

  const lastSeenDrawIdRef = useRef<string | null>(null);
  const hadEmptyWinnersRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);

  const poolTitles = useMemo(() => event.raffles.map((r) => r.title).filter(Boolean), [event.raffles]);

  const suspenseLabels = useMemo(() => {
    const base = [...PLACEHOLDER_TICKERS, ...poolTitles.map((t) => `${t} · drawing…`)];
    return base.length ? base : PLACEHOLDER_TICKERS;
  }, [poolTitles]);

  const runRevealSequence = useCallback(
    (row: PublicWinnerRow) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setHighlightWinner(row);
      setRevealConfetti(false);
      setRevealTicker(0);

      if (reducedMotion) {
        setPhase("winner");
        setRevealConfetti(true);
        lastSeenDrawIdRef.current = row.drawId;
        processingRef.current = false;
        try {
          void navigator.vibrate?.(40);
        } catch {
          /* ignore */
        }
        return;
      }

      setPhase("revealing");
      let step = 0;
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      revealTimerRef.current = setInterval(() => {
        step += 1;
        setRevealTicker((s) => s + 1);
        if (step >= 24) {
          if (revealTimerRef.current) clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
          setPhase("winner");
          setRevealConfetti(true);
          lastSeenDrawIdRef.current = row.drawId;
          processingRef.current = false;
          try {
            void navigator.vibrate?.([30, 50, 30]);
          } catch {
            /* ignore */
          }
        }
      }, 200);
    },
    [reducedMotion],
  );

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/event/${encodeURIComponent(slug)}/public-winners`, {
          cache: "no-store",
        });
        const data = (await res.json()) as PublicWinnersFeedResponse;
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setFeedError("reconnecting");
          return;
        }
        setFeedError(null);
        setWinners(data.winners);

        if (data.winners.length === 0) {
          hadEmptyWinnersRef.current = true;
          return;
        }

        const newest = data.winners[0];
        if (!newest?.drawId) return;

        if (lastSeenDrawIdRef.current === null) {
          if (hadEmptyWinnersRef.current) {
            runRevealSequence(newest);
          } else {
            lastSeenDrawIdRef.current = newest.drawId;
            setHighlightWinner(newest);
            setPhase("winner");
          }
          return;
        }

        if (newest.drawId !== lastSeenDrawIdRef.current) {
          runRevealSequence(newest);
        }
      } catch {
        if (!cancelled) setFeedError("reconnecting");
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 1750);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [slug, runRevealSequence]);

  const cheering = cheerBurst > 0;
  const tickerLabel =
    phase === "revealing" && highlightWinner
      ? suspenseLabels[revealTicker % suspenseLabels.length]
      : null;

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden ${
        isDark ? "bg-neutral-950 text-neutral-50" : "bg-stone-50 text-stone-900"
      }`}
    >
      <ConfettiBurst active={(cheering || revealConfetti) && !reducedMotion} accent={accent} />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-10 h-72 opacity-50"
        style={{
          background: `radial-gradient(ellipse at top, color-mix(in srgb, ${accent} 45%, transparent) 0%, transparent 72%)`,
        }}
      />

      <div className="relative z-20 mx-auto max-w-3xl px-4 pb-28 pt-8 sm:pt-14 md:max-w-4xl lg:max-w-5xl lg:px-8">
        <header className="mb-10 text-center">
          {event.logoUrl ? (
            <img
              src={event.logoUrl}
              alt=""
              className="mx-auto mb-6 h-auto max-h-20 w-auto max-w-[220px] object-contain opacity-95"
            />
          ) : null}
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            Live draw
          </p>
          <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {event.name}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
            Winners are selected using our official, verified drawing process. This page stays in sync and shows each
            winner shortly after they&apos;re drawn—no refresh needed.{" "}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Tap to cheer</span> is only for fun
            (extra confetti) and doesn&apos;t change who wins.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href={`/e/${encodeURIComponent(slug)}`}
              className="text-sm font-medium underline underline-offset-4 hover:opacity-90"
              style={{ color: accent }}
            >
              Back to enter
            </Link>
          </div>
        </header>

        <div
          className="rounded-3xl border p-6 shadow-2xl sm:p-10 md:p-12"
          style={{
            borderColor: isDark ? `${accent}33` : `${accent}44`,
            background: isDark ? `linear-gradient(160deg, ${secondary}42 0%, #0a0a0a 48%)` : "#fffefb",
            boxShadow: `0 0 0 1px ${accent}22, 0 25px 50px -12px rgba(0,0,0,0.35)`,
          }}
        >
          {feedError ? (
            <p className="text-center text-sm text-amber-600 dark:text-amber-300">{feedError}…</p>
          ) : null}

          {phase === "waiting" && winners.length === 0 ? (
            <div className="text-center">
              <div
                className="mx-auto mb-8 h-24 w-24 animate-pulse rounded-full opacity-90"
                style={{
                  boxShadow: `0 0 40px ${accent}55`,
                  background: `conic-gradient(from 180deg, ${accent}, #444, ${accent})`,
                }}
              />
              <h2 className="text-xl font-semibold sm:text-2xl">Waiting for the next draw</h2>
              <p className="mx-auto mt-3 max-w-md text-neutral-600 dark:text-neutral-400">
                When your host taps <strong className="text-neutral-900 dark:text-neutral-100">Draw winner</strong>, the winning name will flash here automatically.
              </p>
            </div>
          ) : null}

          {phase === "revealing" && highlightWinner ? (
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Drawing now
              </p>
              <p className="mt-8 text-xs text-neutral-500 dark:text-neutral-400">
                {highlightWinner.raffleTitle}
              </p>
              <p className="mt-4 text-xs tabular-nums text-neutral-500">
                Pool had {highlightWinner.ticketsInPool.toLocaleString()} ticket
                {highlightWinner.ticketsInPool === 1 ? "" : "s"}
              </p>
              <p key={revealTicker} className="mt-10 min-h-[3.5rem] text-xl font-semibold opacity-95 sm:text-3xl md:text-4xl">
                {reducedMotion ? "Winner selected" : tickerLabel}
              </p>
            </div>
          ) : null}

          {phase === "winner" && highlightWinner ? (
            <div
              className="text-center"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.26em]"
                style={{ color: accent }}
              >
                Winner
              </p>
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">{highlightWinner.raffleTitle}</p>
              <p className="mt-12 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                {highlightWinner.winnerName}
              </p>
              <p className="mx-auto mt-6 max-w-sm text-xs text-neutral-500">
                {highlightWinner.ticketsInPool.toLocaleString()} ticket
                {highlightWinner.ticketsInPool === 1 ? "" : "s"} in this pool ·{" "}
                {new Date(highlightWinner.drewAt).toLocaleString()}
              </p>
              <button
                type="button"
                className="mt-10 min-h-[3.25rem] w-full max-w-xs rounded-2xl px-8 text-base font-semibold text-white shadow-lg transition active:scale-[0.98] motion-reduce:transition-none sm:w-auto touch-manipulation"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${secondary})`,
                  boxShadow: `0 8px 32px ${accent}33`,
                }}
                onClick={() => {
                  setCheerBurst((c) => c + 1);
                  window.setTimeout(() => setCheerBurst((c) => Math.max(0, c - 1)), 2200);
                }}
              >
                Tap to cheer 🎉
              </button>
            </div>
          ) : null}
        </div>

        {winners.length > 1 ? (
          <section className="mt-10">
            <h3 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Recent draws (this event)
            </h3>
            <ul className="mx-auto mt-4 max-w-lg space-y-2 text-sm">
              {winners.slice(1, 8).map((w) => (
                <li
                  key={w.drawId}
                  className={`flex justify-between gap-4 rounded-xl border px-4 py-3 ${
                    isDark ? "border-neutral-800 bg-neutral-900/70" : "border-stone-200 bg-white/90"
                  }`}
                >
                  <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">{w.winnerName}</span>
                  <span className="shrink-0 text-neutral-500 dark:text-neutral-400">{w.raffleTitle}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

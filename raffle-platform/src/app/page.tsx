import Link from "next/link";

/** Matches calendar admin accent (see frontend Admin.jsx). */
const GOLD = "#D4A017";

export default function Home() {
  const year = new Date().getFullYear();
  const eventSlug = "grand-opening";
  const entryPath = `/e/${eventSlug}`;
  const livePath = `${entryPath}/live`;
  const host = "raffle.spectrumoutfitters.com";

  return (
    <main className="min-h-screen bg-black text-neutral-100">
      <section className="relative overflow-hidden border-b border-neutral-900">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            background: `radial-gradient(ellipse 70% 55% at 50% -15%, ${GOLD}, transparent 55%)`,
          }}
        />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 pb-16 pt-12 text-center sm:pt-16 md:px-8">
          <div className="flex w-full max-w-md flex-col items-center gap-5">
            <img
              src="/brand/spectrum-outfitters-logo.png"
              alt="Spectrum Outfitters"
              width={880}
              height={320}
              className="h-auto w-full max-w-[min(100%,26rem)] object-contain"
            />
            <p className="text-balance text-lg text-neutral-300 sm:text-xl">
              Giveaways &amp; raffles — one entry per phone number. Bonus tickets for Instagram, reviews, and referrals.
            </p>
          </div>

          <Link
            href={entryPath}
            className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-xl px-8 text-base font-semibold text-black shadow-lg transition hover:opacity-95 active:scale-[0.99] sm:h-14"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #a67c00)` }}
          >
            Enter Grand Opening Raffle
          </Link>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-5">
            <Link
              href={livePath}
              className="text-sm font-semibold text-neutral-200 underline decoration-neutral-600 underline-offset-4 transition hover:text-white"
            >
              Watch live draw board
            </Link>
            <span className="hidden text-neutral-600 sm:inline" aria-hidden>
              ·
            </span>
            <span className="text-center text-xs text-neutral-500">Synced with each official drawing</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-0 px-4 sm:grid-cols-3 md:px-8">
        {[
          {
            title: "Weighted entries",
            body: "Complete bonus actions to earn extra tickets.",
          },
          {
            title: "One entry per person",
            body: "Duplicate phone numbers are blocked for a fair drawing.",
          },
          {
            title: "Confirmation",
            body: "See your ticket count after you submit the form.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="flex flex-col gap-2 border-b border-neutral-900 py-8 sm:border-b-0 sm:border-r sm:border-neutral-900 sm:px-4 sm:last:border-r-0"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
              {f.title}
            </h3>
            <p className="text-sm text-neutral-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 md:px-8">
        <h2 className="text-base font-semibold text-white">Active event</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Enter the giveaway below, or open the crowd-friendly winner screen for drawings.
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/80 transition hover:border-neutral-600">
          <Link href={entryPath} className="block p-6 pb-5 text-left transition hover:bg-neutral-900/35">
            <span
              className="w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold text-black"
              style={{ background: GOLD }}
            >
              Live
            </span>
            <h3 className="mt-1 text-lg font-semibold text-white">Grand Opening Giveaway</h3>
            <p className="text-sm text-neutral-400">Celebrate our grand opening — multiple prizes.</p>
            <p className="mt-2 text-xs text-neutral-600">
              <span className="font-mono text-neutral-500">
                {host}
                {entryPath}
              </span>
            </p>
            <span className="mt-5 inline-block text-sm font-medium text-neutral-400">Enter giveaway →</span>
          </Link>

          <div className="relative z-10 flex flex-col gap-3 border-t border-neutral-800 bg-neutral-950/95 p-6 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Link
              href={livePath}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:border-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Live draw board
            </Link>
            <p className="text-xs leading-relaxed text-neutral-400">
              Share this on a TV or projector—or everyone can open it on their phone—when winners are announced.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-900">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-8 md:px-8">
          <p className="text-sm text-neutral-600">© {year} Spectrum Outfitters. All rights reserved.</p>
          <nav className="flex gap-5 text-xs text-neutral-500">
            <Link href="/legal/rules" className="hover:text-neutral-200">
              Official Rules
            </Link>
            <Link href="/legal/terms" className="hover:text-neutral-200">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-neutral-200">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

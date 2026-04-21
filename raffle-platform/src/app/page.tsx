import Link from "next/link";

/** Matches calendar admin accent (see frontend Admin.jsx). */
const GOLD = "#D4A017";

export default function Home() {
  const year = new Date().getFullYear();
  const entryPath = "/e/grand-opening";

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
            {/* Official wordmark from frontend/public/logo.svg (inverted for black background) */}
            <img
              src="/logo.svg"
              alt="Spectrum Outfitters"
              width={440}
              height={160}
              className="h-auto w-full max-w-[min(100%,22rem)] object-contain brightness-0 invert"
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
        <p className="mt-1 text-sm text-neutral-500">Tap to enter the live giveaway.</p>
        <Link
          href={entryPath}
          className="mt-5 flex flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6 text-left transition hover:border-neutral-600"
        >
          <span
            className="w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold text-black"
            style={{ background: GOLD }}
          >
            Live
          </span>
          <h3 className="mt-1 text-lg font-semibold text-white">Grand Opening Giveaway</h3>
          <p className="text-sm text-neutral-400">Celebrate our grand opening — multiple prizes.</p>
          <p className="mt-2 text-xs text-neutral-600">
            <span className="font-mono text-neutral-500">raffle.spectrumoutfitters.com{entryPath}</span>
          </p>
        </Link>
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

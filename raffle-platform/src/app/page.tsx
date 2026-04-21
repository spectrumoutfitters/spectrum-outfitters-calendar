import Link from "next/link";

export default function Home() {
  return (
    <main className="dark min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% -20%, #c9a22744, transparent)",
          }}
        />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 pb-20 pt-24 text-center md:px-8 lg:pb-28 lg:pt-32">
          {/* Logo mark */}
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 shadow-xl">
            <span
              className="text-2xl font-black tracking-tighter"
              style={{ color: "#c9a227" }}
            >
              SO
            </span>
          </div>

          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ color: "#c9a227" }}
            >
              Spectrum Outfitters
            </p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
              Giveaways &amp; Raffles
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-neutral-400 md:text-lg">
              Enter to win. One entry per phone number. Bonus tickets available for Instagram follows, reviews, and referrals.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/e/grand-opening"
              className="inline-flex h-14 items-center justify-center rounded-2xl px-8 text-base font-semibold text-neutral-950 shadow-lg transition hover:opacity-90 active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, #c9a227, #8b6d1a)" }}
            >
              Enter Grand Opening Raffle →
            </Link>
            <Link
              href="/setup"
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-neutral-700 px-6 text-sm font-semibold text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              Setup guide
            </Link>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="border-t border-neutral-800">
        <div className="mx-auto grid max-w-5xl gap-0 px-4 sm:grid-cols-3 md:px-8">
          {[
            {
              icon: "🎟️",
              title: "Weighted entries",
              body: "Complete bonus actions to earn extra tickets. Instagram, reviews, and referrals all count.",
            },
            {
              icon: "🔒",
              title: "One entry per person",
              body: "Duplicate phone numbers are blocked. Every participant gets a fair shot.",
            },
            {
              icon: "⚡",
              title: "Instant confirmation",
              body: "Submit the form and see your ticket count in seconds. Winners drawn live by staff.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-3 border-b border-neutral-800 p-8 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="text-base font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-neutral-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active events */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <h2 className="text-lg font-semibold text-white">Active events</h2>
        <p className="mt-1 text-sm text-neutral-400">Click any event to enter.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/e/grand-opening"
            className="group flex flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 transition hover:border-neutral-600 hover:bg-neutral-900"
          >
            <div className="flex items-center justify-between">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-neutral-950"
                style={{ background: "#c9a227" }}
              >
                Live
              </span>
              <span className="text-xs text-neutral-500 transition group-hover:text-neutral-300">
                Enter →
              </span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-white">Grand Opening Giveaway</h3>
            <p className="text-sm text-neutral-400">
              Celebrate the grand opening with us! Multiple prizes up for grabs.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              <code className="font-mono">spectrumoutfitters.com/e/grand-opening</code>
            </p>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 md:px-8">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} Spectrum Outfitters. All rights reserved.
          </p>
          <nav className="flex gap-6 text-xs text-neutral-500">
            <Link href="/legal/rules" className="hover:text-neutral-200">Official Rules</Link>
            <Link href="/legal/terms" className="hover:text-neutral-200">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-neutral-200">Privacy</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

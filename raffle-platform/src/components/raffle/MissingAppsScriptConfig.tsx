import Link from "next/link";

const GOLD = "#D4A017";

const staffAppBase =
  process.env.NEXT_PUBLIC_STAFF_APP_URL?.replace(/\/$/, "") || "https://login.spectrumoutfitters.com";

/** Shown when APPS_SCRIPT_URL / RAFFLE_APPS_SCRIPT_URL is unset on the server */
export function MissingAppsScriptConfig() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
      <img
        src="/brand/spectrum-outfitters-logo.png"
        alt="Spectrum Outfitters"
        width={720}
        height={240}
        className="mb-8 h-auto w-full max-w-sm object-contain"
      />
      <h1 className="text-xl font-semibold text-white sm:text-2xl">Giveaway is almost ready</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
        The raffle app still needs the Google Apps Script connection on the server. An admin can fix this in a few
        minutes—either set the GitHub Actions secret{" "}
        <code className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-neutral-200">RAFFLE_APPS_SCRIPT_URL</code>{" "}
        and redeploy, or add{" "}
        <code className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-neutral-200">APPS_SCRIPT_URL</code>{" "}
        to{" "}
        <code className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-neutral-200">/etc/spectrum-raffle.env</code>{" "}
        on the droplet and restart PM2 (
        <code className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-neutral-200">spectrum-raffle</code>
        ).
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/"
          className="text-sm font-semibold underline decoration-amber-700/50 underline-offset-4"
          style={{ color: GOLD }}
        >
          Back to raffle home
        </Link>
        <a
          href={`${staffAppBase}/admin?raffleSetup=1`}
          className="text-sm text-neutral-500 underline decoration-neutral-600 underline-offset-4 hover:text-neutral-300"
        >
          Staff setup (login)
        </a>
      </div>
    </div>
  );
}

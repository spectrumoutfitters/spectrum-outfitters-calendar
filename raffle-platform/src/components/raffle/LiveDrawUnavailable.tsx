import Link from "next/link";

const GOLD = "#D4A017";

type PropsNoPools = { variant: "no_active_pools"; slug: string };
type PropsLoad = { variant: "cannot_load"; slug: string; error: string };
type Props = PropsNoPools | PropsLoad;

/**
 * Shown when the live board URL is right but the event cannot be shown (clearer than a bare 404).
 */
export function LiveDrawUnavailable(props: Props) {
  const { slug } = props;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-12 text-center text-neutral-100">
      <img
        src="/brand/spectrum-outfitters-icon.png"
        alt=""
        width={56}
        height={56}
        className="mb-6 h-14 w-14 object-contain"
      />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Live draw board</p>
      <h1 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight">
        {props.variant === "no_active_pools"
          ? "No active prize pools for this event"
          : "Could not load this event"}
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
        {props.variant === "no_active_pools" ? (
          <>
            The Events row for <code className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-xs">{slug}</code>{" "}
            is active, but the raffle app did not find any <strong className="text-neutral-200">active</strong> rows in
            the <strong className="text-neutral-200">Raffles</strong> tab with the same slug. Add at least one pool with{" "}
            <code className="rounded bg-neutral-800 px-1 font-mono text-[11px]">slug</code> ={" "}
            <code className="rounded bg-neutral-800 px-1 font-mono text-[11px]">{slug}</code> and{" "}
            <code className="rounded bg-neutral-800 px-1 font-mono text-[11px]">active</code> = TRUE (or leave Active
            empty).
          </>
        ) : (
          <>
            The app could not read your giveaway from Google Apps Script. Code:{" "}
            <code className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-amber-200/90">
              {props.error}
            </code>
            . Check <code className="rounded bg-neutral-800 px-1 font-mono text-[11px]">APPS_SCRIPT_URL</code> on the
            raffle server, redeploy the web app after editing the script, and confirm the sheet slug matches this URL.
          </>
        )}
      </p>
      <p className="mt-6 max-w-md text-xs text-neutral-500">
        If you expected the crowd screen to open but see an old generic &quot;404&quot; page instead, the raffle site may
        need a fresh deploy so the <code className="font-mono text-neutral-400">/e/…/live</code> route exists on the
        server.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-neutral-100 px-6 text-sm font-semibold text-neutral-900"
        >
          Back home
        </Link>
        <Link
          href={`/e/${encodeURIComponent(slug)}`}
          className="text-sm font-semibold underline underline-offset-4"
          style={{ color: GOLD }}
        >
          Try entry page for {slug}
        </Link>
      </div>
    </div>
  );
}

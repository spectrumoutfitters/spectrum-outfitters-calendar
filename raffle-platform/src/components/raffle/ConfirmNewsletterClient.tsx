"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  slug: string;
  token: string;
  newsletterBonus: number;
  manageUrl: string;
};

type State =
  | { kind: "pending" }
  | { kind: "success"; alreadyConfirmed: boolean; bonusTickets: number; totalTickets?: number }
  | { kind: "error"; message: string };

/**
 * One-shot client component. On mount it POSTs the magic-link token to the confirm endpoint to
 * award the newsletter bonus. Idempotent: re-clicking the email link from the same browser tab
 * shows the "already confirmed" state instead of double-awarding tickets.
 */
export default function ConfirmNewsletterClient({ slug, token, newsletterBonus, manageUrl }: Props) {
  const [state, setState] = useState<State>({ kind: "pending" });
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/entry/confirm-newsletter", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, token }),
        });
        const data: Record<string, unknown> = await res.json().catch(() => ({}));
        if (aborted) return;
        if (data && data.ok === true) {
          setState({
            kind: "success",
            alreadyConfirmed: Boolean(data.alreadyConfirmed),
            bonusTickets: Number(data.bonusTickets) || newsletterBonus,
            totalTickets: typeof data.totalTickets === "number" ? data.totalTickets : undefined,
          });
          return;
        }
        const code = String((data && data.code) || (data && data.error) || "");
        const msg = explainError(code, String((data && data.error) || "Could not confirm."));
        setState({ kind: "error", message: msg });
      } catch {
        if (!aborted) setState({ kind: "error", message: "Network error — please retry." });
      }
    })();

    return () => {
      aborted = true;
    };
  }, [slug, token, newsletterBonus]);

  if (state.kind === "pending") {
    return (
      <div className="flex items-center gap-3 text-sm text-stone-600 dark:text-neutral-400">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-amber-500" />
        Confirming your email…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {state.message}
        </div>
        <Link
          href={manageUrl}
          className="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400"
        >
          View my entry
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          ✓
        </span>
        <div className="text-sm">
          {state.alreadyConfirmed ? (
            <>
              <p className="font-semibold text-stone-900 dark:text-neutral-100">Already confirmed.</p>
              <p className="text-stone-600 dark:text-neutral-400">
                Your bonus tickets ({state.bonusTickets}) are already locked in. No further action needed.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-stone-900 dark:text-neutral-100">
                Email confirmed · +{state.bonusTickets} bonus tickets unlocked.
              </p>
              <p className="text-stone-600 dark:text-neutral-400">
                {state.totalTickets != null
                  ? `You now have ${state.totalTickets} ticket${state.totalTickets === 1 ? "" : "s"} in this raffle.`
                  : "Your bonus tickets have been added to your entry."}
              </p>
            </>
          )}
        </div>
      </div>
      <Link
        href={manageUrl}
        className="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400"
      >
        View my entry
      </Link>
    </div>
  );
}

function explainError(code: string, fallback: string): string {
  if (code === "fields") return "This confirmation link is missing required information.";
  if (code === "rate_limited") return "You've clicked confirm a lot. Wait a minute and try again.";
  if (code === "token") return "We couldn't find your entry. Use the confirm link directly from your email.";
  if (code === "opt_in") {
    return "This entry didn't opt in to the newsletter, so there's no bonus to claim. If that's a mistake, sign up via the manage-entry page.";
  }
  if (code === "disabled" || code === "bonus_zero") {
    return "Newsletter bonus tickets aren't enabled for this event.";
  }
  if (code === "timeout") return "Server is slow right now. Please retry in a moment.";
  return fallback || "Could not confirm. Please try again.";
}

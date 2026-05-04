import type { Metadata } from "next";
import Link from "next/link";
import { fetchEventConfig } from "@/lib/eventServer";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; session_id?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const res = await fetchEventConfig(slug);
  if (!res.ok) return { title: "Tickets purchased" };
  return { title: `Tickets purchased · ${res.event.name}` };
}

export default async function BuySuccessPage(props: PageProps) {
  const { slug } = await props.params;
  const { token } = await props.searchParams;
  const res = await fetchEventConfig(slug);

  const eventName = res.ok ? res.event.name : "your raffle";
  const manageUrl = token
    ? `/e/${encodeURIComponent(slug)}/my-entry?token=${encodeURIComponent(token)}`
    : `/e/${encodeURIComponent(slug)}`;

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-12 text-stone-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            ✓
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Payment received</h1>
            <p className="text-sm text-stone-600 dark:text-neutral-400">
              Thanks for backing {eventName}. Your tickets are being added to your entry.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300">
          <p>
            Tickets usually appear within a minute. Refresh your manage-entry page to see the new ticket count and per-pool split — your free entries always count regardless of payment.
          </p>
        </div>

        <Link
          href={manageUrl}
          className="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400"
        >
          View my entry
        </Link>

        <p className="text-center text-xs text-stone-500 dark:text-neutral-500">
          Need help? Reply to your entry email and we'll sort it out.
        </p>
      </div>
    </main>
  );
}

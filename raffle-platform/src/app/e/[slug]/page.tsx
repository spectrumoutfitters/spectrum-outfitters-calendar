import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventEntryClient } from "@/components/raffle/EventEntryClient";
import { fetchEventConfig } from "@/lib/eventServer";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const res = await fetchEventConfig(slug);
  if (!res.ok) return { title: "Event" };
  return {
    title: `${res.event.name} · Raffle`,
    description: res.event.description,
  };
}

function EntryFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-600 dark:bg-neutral-950 dark:text-neutral-400">
      Loading event…
    </div>
  );
}

export default async function EventPage(props: PageProps) {
  const { slug } = await props.params;
  const res = await fetchEventConfig(slug);

  if (!res.ok) {
    if (res.error === "missing_apps_script_url") {
      return (
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-stone-700 dark:text-neutral-200">
          <h1 className="text-2xl font-semibold">Configuration needed</h1>
          <p className="mt-3 text-sm text-stone-600 dark:text-neutral-400">
            Set <code className="rounded bg-stone-200 px-1 dark:bg-neutral-800">APPS_SCRIPT_URL</code> in{" "}
            <code className="rounded bg-stone-200 px-1 dark:bg-neutral-800">.env.local</code>, then restart the dev
            server.
          </p>
          <Link href="/" className="mt-8 inline-block text-amber-700 underline dark:text-amber-300">
            Back home
          </Link>
        </div>
      );
    }
    notFound();
  }

  if (!res.event.active || res.event.raffles.length === 0) {
    notFound();
  }

  return (
    <Suspense fallback={<EntryFallback />}>
      <EventEntryClient event={res.event} />
    </Suspense>
  );
}

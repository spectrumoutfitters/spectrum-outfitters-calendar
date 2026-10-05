import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventEntryClient } from "@/components/raffle/EventEntryClient";
import { MissingAppsScriptConfig } from "@/components/raffle/MissingAppsScriptConfig";
import { fetchEventConfig } from "@/lib/eventServer";
import { eventEntryPageGate } from "@/lib/rafflePublicPageGate";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {  const { slug } = await props.params;
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

  const gate = eventEntryPageGate(res);
  switch (gate.kind) {
    case "missing_apps_script":
      return <MissingAppsScriptConfig />;
    case "not_found":
      return notFound();
    case "entry": {
      if (!res.ok) notFound();
      return (
        <Suspense fallback={<EntryFallback />}>
          <EventEntryClient event={res.event} />
        </Suspense>
      );
    }
    default: {
      const _exhaustive: never = gate;
      return _exhaustive;
    }
  }
}

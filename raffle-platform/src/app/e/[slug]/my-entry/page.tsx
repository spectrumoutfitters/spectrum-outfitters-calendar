import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MyEntryManageClient } from "@/components/raffle/MyEntryManageClient";
import { fetchEventConfig } from "@/lib/eventServer";
import { myEntryPageGate } from "@/lib/rafflePublicPageGate";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const res = await fetchEventConfig(slug);
  if (!res.ok) return { title: "Your entry" };
  return { title: `Your entry · ${res.event.name}` };
}

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-600 dark:bg-neutral-950 dark:text-neutral-400">
      Loading…
    </div>
  );
}

export default async function MyEntryPage(props: PageProps) {
  const { slug } = await props.params;
  const { token: tokenParam } = await props.searchParams;
  const res = await fetchEventConfig(slug);
  const gate = myEntryPageGate(res, tokenParam);
  switch (gate.kind) {
    case "not_found":
      return notFound();
    case "manage": {
      if (!res.ok) notFound();
      return (
        <Suspense fallback={<Fallback />}>
          <MyEntryManageClient event={res.event} slug={slug} initialToken={gate.initialToken} />
        </Suspense>
      );
    }
    default: {
      const _exhaustive: never = gate;
      return _exhaustive;
    }
  }
}

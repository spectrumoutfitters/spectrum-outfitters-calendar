import type { Metadata } from "next";
import Link from "next/link";
import { LiveDrawBoardClient } from "@/components/raffle/LiveDrawBoardClient";
import { LiveDrawUnavailable } from "@/components/raffle/LiveDrawUnavailable";
import { MissingAppsScriptConfig } from "@/components/raffle/MissingAppsScriptConfig";
import { fetchEventConfig } from "@/lib/eventServer";

/** Avoid caching a notFound state; always re-check event + Apps Script */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const res = await fetchEventConfig(slug, { noStore: true });
  if (!res.ok) return { title: "Live draw" };
  return {
    title: `Live draw · ${res.event.name}`,
    description: "Watch giveaway results live — same picks as staff run in admin.",
  };
}

export default async function LiveDrawPage(props: PageProps) {
  const { slug } = await props.params;
  const res = await fetchEventConfig(slug, { noStore: true });

  if (!res.ok) {
    if (res.error === "missing_apps_script_url") {
      return <MissingAppsScriptConfig />;
    }
    return <LiveDrawUnavailable variant="cannot_load" slug={slug} error={res.error} />;
  }

  if (res.event.raffles.length === 0) {
    return <LiveDrawUnavailable variant="no_active_pools" slug={slug} />;
  }

  return (
    <>
      <LiveDrawBoardClient slug={slug} event={res.event} />
      <noscript>
        <div className="fixed bottom-0 left-0 right-0 bg-amber-900 px-4 py-3 text-center text-sm text-amber-100">
          Turn on JavaScript to see the live board.{" "}
          <Link href={`/e/${encodeURIComponent(slug)}`} className="underline">
            Enter raffle
          </Link>
        </div>
      </noscript>
    </>
  );
}

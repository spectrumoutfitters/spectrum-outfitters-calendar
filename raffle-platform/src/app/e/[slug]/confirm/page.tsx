import type { Metadata } from "next";
import { fetchEventConfig } from "@/lib/eventServer";
import ConfirmNewsletterClient from "@/components/raffle/ConfirmNewsletterClient";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const res = await fetchEventConfig(slug);
  if (!res.ok) return { title: "Confirm your email" };
  return { title: `Confirm your email · ${res.event.name}` };
}

export default async function ConfirmNewsletterPage(props: PageProps) {
  const { slug } = await props.params;
  const { token } = await props.searchParams;
  const res = await fetchEventConfig(slug);
  const eventName = res.ok ? res.event.name : "your raffle";
  const newsletterBonus = res.ok ? res.event.newsletterBonusTickets ?? 2 : 2;
  const tokenStr = (token ?? "").trim();
  const manageUrl = tokenStr
    ? `/e/${encodeURIComponent(slug)}/my-entry?token=${encodeURIComponent(tokenStr)}`
    : `/e/${encodeURIComponent(slug)}`;

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-12 text-stone-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-lg font-bold leading-tight">
          Confirm your email · {eventName}
        </h1>
        {tokenStr ? (
          <ConfirmNewsletterClient
            slug={slug}
            token={tokenStr}
            newsletterBonus={newsletterBonus}
            manageUrl={manageUrl}
          />
        ) : (
          <p className="text-sm text-stone-700 dark:text-neutral-300">
            This link is missing a token. Please use the confirmation link in your email exactly as
            it was sent — don't copy and paste pieces of it.
          </p>
        )}
      </div>
    </main>
  );
}

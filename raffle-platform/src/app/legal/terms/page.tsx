import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <article className="max-w-none space-y-4 text-neutral-300">
      <p className="text-sm text-neutral-400">
        <Link href="/" className="text-amber-300 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-50">Terms of Service</h1>
      <p className="text-sm text-neutral-400">Last updated: {new Date().getFullYear()}</p>

      <p>
        By using this site and submitting entries to Spectrum Outfitters promotions, you agree to the following terms.
        Please read them carefully.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Eligibility and conduct</h2>
      <p>
        Promotions are open to eligible participants as defined in the Official Rules for each event. You agree not to
        abuse the entry system, including attempting duplicate entries under different identities, automated
        submissions, or fraudulent bonus claims.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Accurate information</h2>
      <p>
        You agree to submit accurate contact information. Spectrum Outfitters will use the phone number and email
        provided to contact winners. Entries with false or unreachable contact information may be disqualified.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">No purchase necessary</h2>
      <p>
        No purchase is necessary to enter or win any Spectrum Outfitters raffle. A purchase does not improve your
        chances of winning.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Intellectual property</h2>
      <p>
        All content on this site, including branding, copy, and platform code, is the property of Spectrum Outfitters
        or its licensors. You may not reproduce or distribute content without written permission.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Disclaimer</h2>
      <p>
        This platform is provided "as is." Spectrum Outfitters makes no warranties beyond those required by law.
        To the fullest extent permitted, Spectrum Outfitters limits its liability to the value of the prize
        associated with a specific promotion.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Changes to these terms</h2>
      <p>
        Spectrum Outfitters may update these terms at any time. Continued use of the platform after a change constitutes
        acceptance of the revised terms.
      </p>

      <div className="mt-12 flex flex-wrap gap-6 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-200">Home</Link>
        <Link href="/legal/rules" className="hover:text-neutral-200">Official Rules</Link>
        <Link href="/legal/privacy" className="hover:text-neutral-200">Privacy Policy</Link>
      </div>
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-none space-y-4 text-neutral-300">
      <p className="text-sm text-neutral-400">
        <Link href="/" className="text-amber-300 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-50">Privacy Policy</h1>
      <p className="text-sm text-neutral-400">Last updated: {new Date().getFullYear()}</p>

      <p>
        Spectrum Outfitters (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates this raffle and lead capture platform at{" "}
        <code className="rounded bg-neutral-800 px-1 text-amber-200">spectrumoutfitters.com</code>. This policy explains
        what information we collect when you enter a promotion and how we use it.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Information we collect</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong className="text-neutral-100">Contact information</strong> — name, phone number, and email address you submit on the entry form.</li>
        <li><strong className="text-neutral-100">Promotion choices</strong> — the raffle pool you select and any bonus actions you claim.</li>
        <li><strong className="text-neutral-100">Technical data</strong> — IP address and browser user agent, collected to prevent duplicate entries and detect fraud.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">How we use your information</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>To administer the promotion and draw winners.</li>
        <li>To contact you if you win a prize.</li>
        <li>To detect and prevent duplicate entries, fraud, and abuse.</li>
        <li>To contact you about future Spectrum Outfitters promotions, events, and offers (you may opt out at any time).</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">How we store your information</h2>
      <p>
        Entries are stored in a private Google Spreadsheet accessible only to authorized Spectrum Outfitters staff.
        We use standard security practices to protect this data.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Retention</h2>
      <p>
        We retain entry records for as long as necessary to fulfill the purposes described in this policy, comply with
        legal obligations, and resolve disputes.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, or delete your personal data. To exercise
        these rights, contact us at your preferred channel listed on the main Spectrum Outfitters website.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Third-party services</h2>
      <p>
        This platform uses Google Apps Script and Google Sheets to process and store entries. Entry data is subject to
        Google&apos;s privacy practices as well as ours.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The &quot;Last updated&quot; date at the top reflects the most recent
        revision.
      </p>

      <div className="mt-12 flex flex-wrap gap-6 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-200">Home</Link>
        <Link href="/legal/rules" className="hover:text-neutral-200">Official Rules</Link>
        <Link href="/legal/terms" className="hover:text-neutral-200">Terms of Service</Link>
      </div>
    </article>
  );
}

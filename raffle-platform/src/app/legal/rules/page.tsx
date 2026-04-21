import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Official Raffle Rules",
};

export default function RulesPage() {
  return (
    <article className="max-w-none space-y-4 text-neutral-300">
      <p className="text-sm text-neutral-400">
        <Link href="/" className="text-amber-300 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-50">
        Official Raffle Rules
      </h1>
      <p className="text-sm text-neutral-400">Last updated: {new Date().getFullYear()}</p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">1. Sponsor</h2>
      <p>
        Spectrum Outfitters, spectrumoutfitters.com. Each promotion will be identified by name on its entry page.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">2. Eligibility</h2>
      <p>
        Open to legal residents of the United States who are 18 years of age or older at the time of entry. Void where
        prohibited. Employees of Spectrum Outfitters and their immediate family members are not eligible.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">3. Entry period</h2>
      <p>
        Each promotion's start and end dates are displayed on its entry page. Entries submitted outside the promotion
        window will not be eligible.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">4. How to enter</h2>
      <p>
        Navigate to the event entry page at <code className="rounded bg-neutral-800 px-1 text-amber-200">spectrumoutfitters.com/e/[event-slug]</code>,
        complete the form with your name, phone number, and email address, select a raffle pool, and submit. One entry
        per phone number per event.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">5. Bonus tickets</h2>
      <p>
        Participants may claim additional raffle tickets by completing optional bonus actions:
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong className="text-neutral-100">Instagram follow or story mention (+2 tickets)</strong> — Follow @spectrumoutfitters and/or tag us in a story. Verification may be required before prize award.</li>
        <li><strong className="text-neutral-100">Leave a review (+5 tickets)</strong> — Post a Google or Facebook review for Spectrum Outfitters. Your review must be live at the time of prize verification.</li>
        <li><strong className="text-neutral-100">Refer a friend (+3 tickets)</strong> — A referred friend must enter the same event and mention your name. Referrals that cannot be confirmed will not be awarded.</li>
      </ul>
      <p>
        Spectrum Outfitters reserves the right to verify any bonus claim and to disqualify entries where claimed bonuses
        cannot be confirmed.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">6. Winner selection</h2>
      <p>
        Winners are selected by weighted random draw conducted by Spectrum Outfitters staff using the raffle platform's
        draw function. Each ticket in the pool corresponds to one weighted entry. Odds of winning depend on the number
        of eligible tickets submitted.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">7. Winner notification</h2>
      <p>
        Winners will be contacted by phone and/or email using the information submitted at entry. If a winner cannot be
        reached or does not respond within 48 hours, an alternate winner may be drawn.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">8. Prizes</h2>
      <p>
        Prize details, approximate retail values (ARV), and quantities are described on each event's entry page.
        Prizes are non-transferable and may not be redeemed for cash unless otherwise stated.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">9. Limitations of liability</h2>
      <p>
        Spectrum Outfitters is not responsible for technical failures, lost entries, or any damages arising from
        participation. By entering, participants release Spectrum Outfitters from all claims arising from participation
        or prize acceptance.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">10. No purchase necessary</h2>
      <p>
        No purchase is necessary to enter or win. A purchase does not increase your chances of winning.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">11. Governing law</h2>
      <p>
        These rules are governed by the laws of the state in which Spectrum Outfitters operates. Any disputes shall be
        resolved in that jurisdiction.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-neutral-50">12. Winner list</h2>
      <p>
        To request a winner list for any completed promotion, contact Spectrum Outfitters directly via your preferred
        contact channel.
      </p>

      <div className="mt-12 flex flex-wrap gap-6 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-200">Home</Link>
        <Link href="/legal/terms" className="hover:text-neutral-200">Terms of Service</Link>
        <Link href="/legal/privacy" className="hover:text-neutral-200">Privacy Policy</Link>
      </div>
    </article>
  );
}

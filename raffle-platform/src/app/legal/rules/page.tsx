import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Official Raffle Rules",
};

export default function RulesPage() {
  return (
    <article className="max-w-none space-y-4 text-[15px] leading-relaxed text-neutral-300 sm:text-base">
      <p className="text-sm text-neutral-400">
        <Link href="/" className="min-h-11 inline-flex items-center text-amber-300 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
        Official Raffle Rules
      </h1>
      <p className="text-sm text-neutral-400">Last updated: {new Date().getFullYear()}</p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">1. Sponsor</h2>
      <p>
        Spectrum Outfitters, spectrumoutfitters.com. Each promotion will be identified by name on its entry page.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">2. Eligibility</h2>
      <p>
        Open to legal residents of the United States who are 18 years of age or older at the time of entry. Void where
        prohibited. Employees of Spectrum Outfitters and their immediate family members are not eligible.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">3. Entry period</h2>
      <p>
        Each promotion's start and end dates are displayed on its entry page. Entries submitted outside the promotion
        window will not be eligible.
      </p>

      <h2 id="how-to-enter" className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">
        4. How to enter
      </h2>
      <p>
        Navigate to the event entry page (for example{" "}
        <code className="break-all rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-amber-200 sm:text-sm">
          spectrumoutfitters.com/e/your-event-slug
        </code>
        ), complete the form with your name, phone number, and email address, accept these rules, and submit.
      </p>
      <p>
        <strong className="text-neutral-100">One submission per phone number per event.</strong> You may either (a){" "}
        <strong className="text-neutral-100">focus all of your tickets on a single prize pool</strong> you select on the
        form, or (b) if the entry page offers it, <strong className="text-neutral-100">split your tickets across every active
        prize pool</strong> for that event so you have a weighted chance in each pool’s drawing. When you split, your total
        ticket count (including any bonus tickets you qualify for) is divided across pools as described on the entry page
        (equal split by default, or optional custom weights you provide). Split entries may be recorded as fractional ticket
        weights per pool; each pool’s drawing only includes tickets allocated to that pool.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">5. Bonus tickets</h2>
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

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">6. Winner selection</h2>
      <p>
        Winners are selected by weighted random draw conducted by Spectrum Outfitters staff using the raffle platform’s
        draw tools. Each prize pool is drawn separately: only tickets recorded for that pool (including fractional weights
        when entrants split across pools) are eligible in that pool’s draw. Odds in a given pool depend on the number and
        weight of eligible tickets in that pool at the time of the draw.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">7. Winner notification</h2>
      <p>
        Winners will be contacted by phone and/or email using the information submitted at entry. If a winner cannot be
        reached or does not respond within 48 hours, an alternate winner may be drawn.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">8. Prizes</h2>
      <p>
        Prize details, approximate retail values (ARV), and quantities are described on each event's entry page.
        Prizes are non-transferable and may not be redeemed for cash unless otherwise stated.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">9. Limitations of liability</h2>
      <p>
        Spectrum Outfitters is not responsible for technical failures, lost entries, or any damages arising from
        participation. By entering, participants release Spectrum Outfitters from all claims arising from participation
        or prize acceptance.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">10. No purchase necessary</h2>
      <p>
        No purchase is necessary to enter or win. A purchase does not increase your chances of winning.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">11. Governing law</h2>
      <p>
        These rules are governed by the laws of the state in which Spectrum Outfitters operates. Any disputes shall be
        resolved in that jurisdiction.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">12. Winner list</h2>
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

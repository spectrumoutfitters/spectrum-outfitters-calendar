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
        <strong className="text-neutral-100">One free submission per phone number per event.</strong> You choose how to
        distribute your total ticket count (free base ticket + verified bonus tickets) across the prize pools listed on
        the entry page. The sum of tickets you assign to pools must equal your total ticket count. Each pool is drawn
        separately and only includes tickets you allocated to that pool. You can revisit your private manage-entry link
        (sent by email when enabled) to adjust the split until shortly before each pool&apos;s scheduled draw.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">5. Bonus tickets (free)</h2>
      <p>
        Participants may claim additional raffle tickets by completing optional bonus actions listed on each event&apos;s
        entry page. We only offer bonus actions our staff can verify before awarding prizes — currently:
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <strong className="text-neutral-100">Public review:</strong> post a public Google, Facebook, or Yelp review and
          paste the link on the entry form. Staff click every submitted link before drawing.
        </li>
        <li>
          <strong className="text-neutral-100">Refer a friend:</strong> the friend must submit their own entry and type
          your full name in their referral field. The bonus tickets only count once that referral is recorded.
        </li>
      </ul>
      <p>
        Spectrum Outfitters reserves the right to verify any bonus claim and to disqualify entries where claimed bonuses
        cannot be confirmed.
      </p>

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">5a. Optional paid tickets</h2>
      <p>
        Where allowed by law and offered by the sponsor on the entry page, participants may purchase additional tickets
        through Stripe at the price displayed on the entry page. Paid tickets are added to the prize pool(s) the
        purchaser selects at checkout and are subject to the same draw process as free tickets. Paid tickets are
        non-refundable once a draw has occurred.
      </p>
      <p>
        Free entry remains available at all times via the methods in Section 4. Where a sponsor is not authorized to sell
        raffle tickets in a participant&apos;s jurisdiction, paid tickets will not be made available there and are void
        where prohibited.
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

      <h2 className="mt-8 scroll-mt-4 text-lg font-semibold text-neutral-50 sm:mt-10 sm:text-xl">10. Free entry available</h2>
      <p>
        A free entry path is always available via Section 4 above and includes the free bonus tickets described in
        Section 5. Optional paid tickets (Section 5a), where offered, are an additional way to add weight to a pool and
        are not required to enter or win.
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

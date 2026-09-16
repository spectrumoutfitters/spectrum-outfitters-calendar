/** Hide paid-ticket UI in test mode, when disabled, or when price is 0. */
export function isPaidTicketsUiEnabled({ paidTicketsEnabled, ticketPriceCents, testMode }) {
  const priceCents = Math.max(0, Math.floor(Number(ticketPriceCents) || 0));
  return Boolean(paidTicketsEnabled) && priceCents > 0 && !testMode;
}

/**
 * Newsletter checkbox only counts when the event did not set `newsletterBonusEnabled`
 * to boolean false *and* the bonus ticket count is a positive integer.
 * Sheet `0` for enabled still shows (only exact `false` hides).
 */
export function isNewsletterBonusShown(newsletterBonusEnabled, newsletterBonusTickets) {
  const enabled = newsletterBonusEnabled !== false;
  const tickets = Math.max(0, Math.floor(Number(newsletterBonusTickets) || 0));
  return enabled && tickets > 0;
}

export function newsletterOptInForSubmit(shown, optedIn) {
  return shown ? Boolean(optedIn) : false;
}

/** Client-side pool + terms checks before POST /api/entry. */
export function validateEntryPoolSplit({ positivePools, poolSum, previewTickets, termsAccepted }) {
  if (positivePools < 1) {
    return 'Give at least one ticket to a prize pool (use the number next to each pool).';
  }
  if (poolSum !== previewTickets) {
    return `Tickets per pool must add up to ${previewTickets} (you have ${poolSum} assigned). Adjust each pool so the counts match your total.`;
  }
  if (!termsAccepted) {
    return 'Please accept the official rules and terms.';
  }
  return null;
}

export function formatCheckoutError(code) {
  switch (code) {
    case 'paid_tickets_disabled':
      return "Paid tickets aren't enabled for this event yet.";
    case 'ticket_price_not_set':
      return "Ticket pricing isn't configured yet.";
    case 'must_buy_at_least_one':
      return 'Pick at least one ticket before checking out.';
    case 'entry_locked':
      return 'This entry is locked because a draw is too close.';
    case 'stripe_not_configured':
      return 'Online payments are temporarily unavailable.';
    case 'missing_fields':
      return 'Something is missing from the request — refresh and try again.';
    default:
      if (code && code.startsWith('max_')) return code.replace(/_/g, ' ');
      return "We couldn't open Stripe right now.";
  }
}

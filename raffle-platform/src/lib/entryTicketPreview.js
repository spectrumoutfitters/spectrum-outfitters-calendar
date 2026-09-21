/** Base/free tickets before bonuses. 0/NaN/empty fall back to 2; negative clamps to 1. */
export function normalizeBaseTickets(value) {
  return Math.max(1, Math.floor(Number(value) || 2));
}

export function normalizeNewsletterBonus(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function paidTicketPriceCents(ticketPriceCents) {
  return Math.max(0, Math.floor(Number(ticketPriceCents) || 0));
}

export function paidTicketsMaxPerPurchase(max) {
  return Math.max(1, Math.floor(Number(max) || 100));
}

/**
 * Public entry form: Stripe buy UI only when paid tickets are on, price floors to ≥1 cent, and not test mode.
 * NaN/'abc'/0.9 all look like "no price" after floor.
 */
export function paidTicketsCheckoutEnabled({ paidTicketsEnabled, ticketPriceCents, testMode }) {
  const priceCents = paidTicketPriceCents(ticketPriceCents);
  return Boolean(paidTicketsEnabled) && priceCents > 0 && !testMode;
}

/**
 * Manage-entry buy card uses `?? 0` without floor, so a fractional 0.9 still shows checkout.
 */
export function paidTicketsManageEnabled({ paidTicketsEnabled, ticketPriceCents, testMode }) {
  return Boolean(!testMode && paidTicketsEnabled && (ticketPriceCents ?? 0) > 0);
}

/** Newsletter bonus is offered when not explicitly disabled and tickets > 0. */
export function newsletterShowsBonus(newsletterEnabled, newsletterBonus) {
  return newsletterEnabled !== false && normalizeNewsletterBonus(newsletterBonus) > 0;
}

/** Entry-form ticket preview: bonus-rule total plus newsletter only when the checkbox is on. */
export function previewEntryTickets({
  baseOnly,
  newsletterEnabled,
  newsletterBonus,
  newsletterOptIn,
}) {
  const bonus = normalizeNewsletterBonus(newsletterBonus);
  if (newsletterShowsBonus(newsletterEnabled, bonus) && newsletterOptIn) {
    return baseOnly + bonus;
  }
  return baseOnly;
}

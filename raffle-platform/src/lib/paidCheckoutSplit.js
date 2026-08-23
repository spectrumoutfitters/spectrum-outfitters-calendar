/**
 * Paid raffle checkout gates (price, max, pool split).
 * Mirrors raffle-platform/src/app/api/raffle/checkout/route.ts before Stripe.
 */

export function parseCheckoutRequest(body) {
  const slug = String(body?.slug || '').trim();
  const token = String(body?.token || '').trim();
  const split = body?.ticketSplit && typeof body.ticketSplit === 'object' ? body.ticketSplit : null;
  if (!slug || !token || !split) {
    return { ok: false, error: 'missing_fields' };
  }
  return { ok: true, slug, token, split };
}

export function ticketPriceCents(event) {
  return Math.max(0, Math.floor(Number(event?.ticketPriceCents) || 0));
}

export function ticketCurrency(event) {
  return String(event?.ticketCurrency || 'usd').toLowerCase();
}

/** 0 / NaN fall through to 100 via `||`; negatives clamp to 1 via Math.max. */
export function paidTicketsMaxPerPurchase(event) {
  return Math.max(1, Math.floor(Number(event?.paidTicketsMaxPerPurchase) || 100));
}

/**
 * Unknown pool ids are dropped. Non-positive / NaN quantities become 0 and are omitted.
 * Arrays are objects, so a ticketSplit array is accepted (same as the route).
 */
export function sanitizePaidTicketSplit(split, raffles) {
  const validPoolIds = new Set((raffles || []).map((r) => r.id));
  const cleanSplit = {};
  let totalTickets = 0;
  for (const [poolId, raw] of Object.entries(split || {})) {
    const id = String(poolId);
    if (!validPoolIds.has(id)) continue;
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    if (n > 0) {
      cleanSplit[id] = n;
      totalTickets += n;
    }
  }
  return { cleanSplit, totalTickets };
}

export function evaluatePaidTicketPurchase(event, split) {
  if (!event?.paidTicketsEnabled) {
    return { ok: false, error: 'paid_tickets_disabled' };
  }
  const priceCents = ticketPriceCents(event);
  if (priceCents <= 0) {
    return { ok: false, error: 'ticket_price_not_set' };
  }
  const currency = ticketCurrency(event);
  const maxPerPurchase = paidTicketsMaxPerPurchase(event);
  const { cleanSplit, totalTickets } = sanitizePaidTicketSplit(split, event.raffles);
  if (totalTickets <= 0) {
    return { ok: false, error: 'must_buy_at_least_one' };
  }
  if (totalTickets > maxPerPurchase) {
    return { ok: false, error: `max_${maxPerPurchase}_per_purchase`, maxPerPurchase };
  }
  return { ok: true, cleanSplit, totalTickets, priceCents, currency, maxPerPurchase };
}

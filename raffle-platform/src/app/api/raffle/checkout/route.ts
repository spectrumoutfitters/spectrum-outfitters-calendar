import { NextResponse } from "next/server";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";
import { getClientIpFromRequest } from "@/lib/clientIp";
import { evaluatePaidTicketPurchase, parseCheckoutRequest } from "@/lib/paidCheckoutSplit";
import { getRaffleSiteOrigin, getStripeClient } from "@/lib/stripe";
import type { MyEntrySnapshot, EventConfig } from "@/lib/types";

/**
 * Body:
 *   {
 *     slug: string,
 *     token: string,           // entryToken returned by submitEntry / from email magic link
 *     ticketSplit: { [poolId]: integer >= 0 },  // total > 0
 *   }
 *
 * Server validates against the live Apps Script entry + event config (price, max), then creates a
 * Stripe Checkout Session with metadata the webhook uses to write paid tickets to the sheet.
 */
export async function POST(request: Request) {
  let body: { slug?: string; token?: string; ticketSplit?: Record<string, number> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseCheckoutRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const { slug, token, split } = parsed;

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const ip = getClientIpFromRequest(request);

  let event: EventConfig | null = null;
  try {
    const evRes = await fetch(`${base}?action=getEvent&slug=${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const evData = (await evRes.json()) as { ok?: boolean; event?: EventConfig; error?: string };
    if (!evRes.ok || !evData.ok || !evData.event) {
      return NextResponse.json({ ok: false, error: evData.error || "event_load_failed" }, { status: 502 });
    }
    event = evData.event;
  } catch {
    return NextResponse.json({ ok: false, error: "event_load_failed" }, { status: 502 });
  }

  const purchase = evaluatePaidTicketPurchase(event, split);
  if (!purchase.ok) {
    const payload: { ok: false; error: string; maxPerPurchase?: number } = {
      ok: false,
      error: purchase.error,
    };
    if (purchase.maxPerPurchase != null) payload.maxPerPurchase = purchase.maxPerPurchase;
    return NextResponse.json(payload, { status: 400 });
  }
  const { cleanSplit, totalTickets, priceCents, currency } = purchase;

  let snapshot: MyEntrySnapshot | null = null;
  try {
    const entryRes = await fetchAppsScriptPost(base, {
      action: "getEntryByToken",
      payload: { slug, token, clientIp: ip },
    });
    const entryData = (await entryRes.json()) as { ok?: boolean; entry?: MyEntrySnapshot; error?: string };
    if (!entryRes.ok || !entryData.ok || !entryData.entry) {
      return NextResponse.json({ ok: false, error: entryData.error || "entry_lookup_failed" }, { status: 404 });
    }
    snapshot = entryData.entry;
  } catch {
    return NextResponse.json({ ok: false, error: "entry_lookup_failed" }, { status: 502 });
  }

  if (snapshot.editLocked) {
    return NextResponse.json({ ok: false, error: "entry_locked" }, { status: 409 });
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 503 });
  }

  const origin = getRaffleSiteOrigin() || new URL(request.url).origin;
  const successUrl = `${origin}/e/${encodeURIComponent(slug)}/buy/success?token=${encodeURIComponent(token)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/e/${encodeURIComponent(slug)}/my-entry?token=${encodeURIComponent(token)}&buy=cancel`;

  const productName = `Raffle tickets — ${event.name || "Giveaway"}`;
  const description = `${totalTickets} extra ticket${totalTickets === 1 ? "" : "s"} for ${snapshot.name || snapshot.emailMasked}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      submit_type: "pay",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: undefined,
      line_items: [
        {
          quantity: totalTickets,
          price_data: {
            currency,
            unit_amount: priceCents,
            product_data: {
              name: productName,
              description,
            },
          },
        },
      ],
      metadata: {
        raffle_slug: slug,
        entry_token: token,
        ticket_split: JSON.stringify(cleanSplit).slice(0, 480),
        total_tickets: String(totalTickets),
      },
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      totalTickets,
      priceCents,
      currency,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checkout_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

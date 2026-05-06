import { NextResponse } from "next/server";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";
import { getClientIpFromRequest } from "@/lib/clientIp";
import { getRaffleSiteOrigin, getStripeClient } from "@/lib/stripe";
import type { MyEntrySnapshot, EventConfig } from "@/lib/types";

const STRIPE_METADATA_VALUE_LIMIT = 480;
const STRIPE_METADATA_MAX_TICKET_SPLIT_PARTS = 46;

function addTicketSplitMetadata(metadata: Record<string, string>, ticketSplitJson: string): boolean {
  const chunks = ticketSplitJson.match(new RegExp(`.{1,${STRIPE_METADATA_VALUE_LIMIT}}`, "g")) || [ticketSplitJson];
  if (chunks.length > STRIPE_METADATA_MAX_TICKET_SPLIT_PARTS) return false;
  if (chunks.length === 1) {
    metadata.ticket_split = chunks[0];
    return true;
  }
  metadata.ticket_split_parts = String(chunks.length);
  chunks.forEach((chunk, i) => {
    metadata[`ticket_split_${i}`] = chunk;
  });
  return true;
}

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

  const slug = String(body?.slug || "").trim();
  const token = String(body?.token || "").trim();
  const split = body?.ticketSplit && typeof body.ticketSplit === "object" ? body.ticketSplit : null;
  if (!slug || !token || !split) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

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

  if (!event.paidTicketsEnabled) {
    return NextResponse.json({ ok: false, error: "paid_tickets_disabled" }, { status: 400 });
  }
  const priceCents = Math.max(0, Math.floor(Number(event.ticketPriceCents) || 0));
  if (priceCents <= 0) {
    return NextResponse.json({ ok: false, error: "ticket_price_not_set" }, { status: 400 });
  }
  const currency = String(event.ticketCurrency || "usd").toLowerCase();
  const maxPerPurchase = Math.max(1, Math.floor(Number(event.paidTicketsMaxPerPurchase) || 100));

  const validPoolIds = new Set(event.raffles.map((r) => r.id));
  const cleanSplit: Record<string, number> = {};
  let totalTickets = 0;
  for (const [poolId, raw] of Object.entries(split)) {
    const id = String(poolId);
    if (!validPoolIds.has(id)) continue;
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    if (n > 0) {
      cleanSplit[id] = n;
      totalTickets += n;
    }
  }
  if (totalTickets <= 0) {
    return NextResponse.json({ ok: false, error: "must_buy_at_least_one" }, { status: 400 });
  }
  if (totalTickets > maxPerPurchase) {
    return NextResponse.json(
      { ok: false, error: `max_${maxPerPurchase}_per_purchase`, maxPerPurchase },
      { status: 400 },
    );
  }

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
  const metadata: Record<string, string> = {
    raffle_slug: slug,
    entry_token: token,
    total_tickets: String(totalTickets),
  };
  if (!addTicketSplitMetadata(metadata, JSON.stringify(cleanSplit))) {
    return NextResponse.json({ ok: false, error: "ticket_split_too_large" }, { status: 400 });
  }

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
      metadata,
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

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { signPaidPurchasePayload } from "@/lib/paidPurchaseSign";
import { decodeTicketSplitMetadata } from "@/lib/stripeTicketSplitMetadata";

export const runtime = "nodejs";

/** Stripe webhook: applies paid tickets to the entry sheet via signed call to Apps Script. */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "missing_stripe_webhook_secret" }, { status: 503 });
  }
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });

  const raw = await request.text();
  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bad_signature";
    return NextResponse.json({ ok: false, error: `verification_failed: ${msg}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ ok: true, ignored: true, type: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return NextResponse.json({ ok: true, awaiting_payment: true });
  }

  const md = session.metadata || {};
  const slug = String(md.raffle_slug || "").trim();
  const entryToken = String(md.entry_token || "").trim();
  const totalTickets = Math.max(0, Math.floor(Number(md.total_tickets) || 0));
  const ticketSplit = decodeTicketSplitMetadata(md);

  if (!slug || !entryToken || totalTickets <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_session_metadata" }, { status: 400 });
  }

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "apps_script_not_configured" }, { status: 503 });
  }

  const payload = {
    slug,
    token: entryToken,
    stripeSessionId: session.id,
    totalPaidTickets: totalTickets,
    ticketSplit,
    paidAt: new Date(((session.created ?? Date.now() / 1000) as number) * 1000).toISOString(),
    amountTotal: typeof session.amount_total === "number" ? session.amount_total : null,
    currency: session.currency || "usd",
    clientIp: "stripe-webhook",
    userAgent: "stripe-webhook",
  };

  const payloadString = JSON.stringify(payload);
  let signed;
  try {
    signed = signPaidPurchasePayload(payloadString);
  } catch {
    return NextResponse.json({ ok: false, error: "missing_paid_purchase_secret" }, { status: 503 });
  }

  try {
    const res = await fetchAppsScriptPost(base, {
      action: "applyPaidTickets",
      payload,
      payloadString,
      signature: signed.signature,
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: "upstream_not_json", raw: text.slice(0, 500) }, { status: 502 });
    }
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "apps_script_error", upstream: data }, { status: 502 });
    }
    return NextResponse.json({ ok: true, applied: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upstream_unreachable";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

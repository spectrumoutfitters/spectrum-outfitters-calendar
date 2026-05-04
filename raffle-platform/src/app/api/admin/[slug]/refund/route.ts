import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = {
  stripeSessionId?: string;
  /** Plain-text admin password re-typed in the confirm dialog. Forwarded to Apps Script. */
  adminPassword?: string;
};

/**
 * Refund a paid raffle purchase.
 * 1. Re-validate admin key (sent in `x-admin-key` header AND optionally re-confirmed via body).
 * 2. Look up the Stripe session → refund the underlying payment_intent.
 * 3. Tell Apps Script to mark those rows refunded + zero their tickets.
 *
 * Idempotent: re-refunds say "already refunded" cleanly. We never reverse the sheet
 * change without a real Stripe refund response (stops accidental ticket removal).
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const headerKey = request.headers.get("x-admin-key")?.trim() || "";
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const stripeSessionId = String(body.stripeSessionId || "").trim();
  const typedPassword = String(body.adminPassword || "").trim();
  if (!stripeSessionId) {
    return NextResponse.json({ ok: false, error: "missing_session" }, { status: 400 });
  }
  if (!typedPassword) {
    return NextResponse.json({ ok: false, error: "password_required" }, { status: 401 });
  }
  if (headerKey && typedPassword !== headerKey) {
    return NextResponse.json({ ok: false, error: "password_mismatch" }, { status: 401 });
  }

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 503 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stripe_lookup_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { ok: false, error: "not_paid", paymentStatus: session.payment_status },
      { status: 409 },
    );
  }

  const piId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || "";
  if (!piId) {
    return NextResponse.json({ ok: false, error: "no_payment_intent" }, { status: 502 });
  }

  let refund: Stripe.Refund | null = null;
  let alreadyRefundedOnStripe = false;
  try {
    refund = await stripe.refunds.create({
      payment_intent: piId,
      reason: "requested_by_customer",
      metadata: { raffle_slug: slug, raffle_session: stripeSessionId, source: "admin_panel" },
    });
  } catch (e) {
    const stripeErr = e as { code?: string; type?: string; statusCode?: number; message?: string };
    if (stripeErr?.code === "charge_already_refunded") {
      alreadyRefundedOnStripe = true;
    } else if (stripeErr?.type === "StripePermissionError" || stripeErr?.statusCode === 403) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "stripe_missing_refund_permission: the API key in STRIPE_SECRET_KEY does not have 'Refunds: Write'. Roll a new restricted key with that permission and replace STRIPE_SECRET_KEY.",
        },
        { status: 403 },
      );
    } else {
      return NextResponse.json(
        { ok: false, error: stripeErr?.message || "refund_failed", stripeCode: stripeErr?.code || null },
        { status: 502 },
      );
    }
  }

  try {
    const sheetRes = await fetchAppsScriptPost(base, {
      action: "refundPaidPurchase",
      slug,
      adminKey: headerKey || typedPassword,
      stripeSessionId,
      refundId: refund?.id || "",
      actor: "admin_panel",
    });
    const sheetText = await sheetRes.text();
    let sheetData: unknown;
    try {
      sheetData = JSON.parse(sheetText);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "refund_done_but_sheet_failed: Stripe refund succeeded but Apps Script returned invalid JSON; sheet not updated.",
          refundId: refund?.id || "",
        },
        { status: 502 },
      );
    }
    if (!sheetRes.ok) {
      return NextResponse.json(
        { ok: false, error: "refund_done_but_sheet_failed", upstream: sheetData, refundId: refund?.id || "" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      refundId: refund?.id || null,
      stripeStatus: refund?.status || (alreadyRefundedOnStripe ? "already_refunded" : "unknown"),
      alreadyRefundedOnStripe,
      sheet: sheetData,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "apps_script_unreachable";
    return NextResponse.json(
      { ok: false, error: `refund_done_but_sheet_failed: ${msg}`, refundId: refund?.id || "" },
      { status: 502 },
    );
  }
}

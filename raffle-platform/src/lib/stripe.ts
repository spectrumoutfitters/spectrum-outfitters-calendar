import Stripe from "stripe";

let cached: Stripe | null = null;

/** Lazy Stripe client — throws clearly when STRIPE_SECRET_KEY is not set on the server. */
export function getStripeClient(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("missing_stripe_secret_key");
  }
  cached = new Stripe(key);
  return cached;
}

/** Site origin used for Stripe success/cancel return URLs. */
export function getRaffleSiteOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_RAFFLE_SITE_URL?.trim() ||
    process.env.RAFFLE_SITE_URL?.trim() ||
    "";
  return fromEnv.replace(/\/$/, "");
}

import Stripe from "stripe";
export { getRaffleSiteOrigin } from "./env.ts";

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

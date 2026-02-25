/**
 * Stripe revenue sync: list charges by date range, aggregate by day, for daily income.
 * Used when you process payments via Stripe; sync or webhook populates processor_daily_revenue.
 */

const PROCESSOR_NAME = 'stripe';

/**
 * Get Stripe client only when API key is set. Uses dynamic import so server starts without stripe installed.
 */
async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_') === false) return null;
  const Stripe = (await import('stripe')).default;
  return new Stripe(key);
}

/**
 * List all charges in a date range (paginated). Date is interpreted in server local date.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array<{ amount: number, amount_refunded: number, created: number, status: string, paid: boolean }>>}
 */
export async function getStripeChargesByDateRange(startDate, endDate) {
  const stripe = await getStripe();
  if (!stripe) return [];

  const start = Math.floor(new Date(startDate + 'T00:00:00').getTime() / 1000);
  const end = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000);

  const charges = [];
  let hasMore = true;
  let startingAfter = undefined;

  while (hasMore) {
    const list = await stripe.charges.list({
      created: { gte: start, lte: end },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });
    charges.push(...(list.data || []));
    hasMore = list.has_more === true && list.data?.length > 0;
    if (hasMore && list.data?.length) startingAfter = list.data[list.data.length - 1].id;
  }

  return charges;
}

/**
 * Aggregate Stripe charges into daily totals (net of refunds). Only succeeded/paid charges.
 * @param {Array} charges - from getStripeChargesByDateRange
 * @returns {Array<{ date: string, revenue: number, charge_count: number, refund_total: number }>}
 */
export function aggregateStripeChargesByDay(charges) {
  const byDay = {};

  for (const c of charges) {
    const status = (c.status || '').toLowerCase();
    if (status !== 'succeeded') continue;
    if (c.paid !== true) continue;

    const date = new Date(c.created * 1000).toISOString().slice(0, 10);
    if (!byDay[date]) byDay[date] = { revenue: 0, charges: 0, refunds: 0 };

    const amountCents = c.amount || 0;
    const refundCents = c.amount_refunded || 0;
    byDay[date].revenue += amountCents - refundCents;
    byDay[date].charges += 1;
    byDay[date].refunds += refundCents;
  }

  return Object.entries(byDay).map(([date, d]) => ({
    date,
    revenue: (d.revenue / 100).toFixed(2),
    charge_count: d.charges,
    refund_total: (d.refunds / 100).toFixed(2),
  }));
}

/**
 * Verify Stripe webhook signature (optional but recommended).
 * @param {string} payload - raw request body string
 * @param {string} signature - Stripe-Signature header
 * @returns {object|null} parsed event or null if invalid
 */
export async function verifyStripeWebhook(payload, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;

  const stripe = await getStripe();
  if (!stripe) return null;

  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.warn('Stripe webhook signature verification failed:', err.message);
    return null;
  }
}

export { PROCESSOR_NAME };

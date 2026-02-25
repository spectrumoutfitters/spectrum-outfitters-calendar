/**
 * Payment processor revenue: Valor Pay or Stripe. Syncs charges into processor_daily_revenue
 * so daily income can use them when Shop Monkey has no data for that day.
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import db from '../database/db.js';
import {
  getStripeChargesByDateRange,
  aggregateStripeChargesByDay,
  verifyStripeWebhook,
  PROCESSOR_NAME as STRIPE_PROCESSOR,
} from '../utils/stripeRevenue.js';
import {
  getValorPayTransactionsByDateRange,
  aggregateValorPayByDay,
  PROCESSOR_NAME as VALOR_PROCESSOR,
  isConfigured as isValorConfigured,
} from '../utils/valorPayRevenue.js';

const router = express.Router();

/**
 * Shared sync: fetch Stripe charges for date range, aggregate by day, upsert processor_daily_revenue.
 */
export async function syncStripeRevenue(startDate, endDate) {
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || '2015-01-01';

  const charges = await getStripeChargesByDateRange(start, end);
  const daily = aggregateStripeChargesByDay(charges);

  for (const d of daily) {
    await db.runAsync(
      `INSERT INTO processor_daily_revenue (date, processor, revenue, charge_count, refund_total, synced_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(date, processor) DO UPDATE SET
         revenue = excluded.revenue,
         charge_count = excluded.charge_count,
         refund_total = excluded.refund_total,
         synced_at = CURRENT_TIMESTAMP`,
      [d.date, STRIPE_PROCESSOR, d.revenue, d.charge_count, d.refund_total]
    );
  }

  return { days_synced: daily.length, start_date: start, end_date: end };
}

/**
 * Sync Valor Pay transactions for date range into processor_daily_revenue (processor = 'valorpay').
 */
export async function syncValorPayRevenue(startDate, endDate) {
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || '2015-01-01';

  const transactions = await getValorPayTransactionsByDateRange(start, end);
  const daily = aggregateValorPayByDay(transactions);

  for (const d of daily) {
    await db.runAsync(
      `INSERT INTO processor_daily_revenue (date, processor, revenue, charge_count, refund_total, synced_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(date, processor) DO UPDATE SET
         revenue = excluded.revenue,
         charge_count = excluded.charge_count,
         refund_total = excluded.refund_total,
         synced_at = CURRENT_TIMESTAMP`,
      [d.date, VALOR_PROCESSOR, d.revenue, d.charge_count, d.refund_total]
    );
  }

  return { days_synced: daily.length, start_date: start, end_date: end };
}

/** Which processor is configured for sync (Valor Pay takes precedence). */
function getActiveProcessor() {
  return isValorConfigured() ? VALOR_PROCESSOR : STRIPE_PROCESSOR;
}

// ─── Which processor is configured (for UI label before status loads) ─────────
router.get('/revenue/configured', authenticateToken, (req, res) => {
  res.json({ processor: getActiveProcessor() });
});

/** Run the active processor's sync. */
export async function syncPaymentProcessorRevenue(startDate, endDate) {
  if (isValorConfigured()) return syncValorPayRevenue(startDate, endDate);
  return syncStripeRevenue(startDate, endDate);
}

// ─── Authenticated routes (sync + status) ───────────────────────────────────

router.post('/revenue/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await syncPaymentProcessorRevenue(req.body.start_date, req.body.end_date);
    res.json(result);
  } catch (error) {
    console.error('Payment processor revenue sync error:', error);
    const hint = isValorConfigured()
      ? 'Check VALOR_APP_ID, VALOR_APP_KEY and Valor Pay API URL in backend/.env'
      : process.env.STRIPE_SECRET_KEY ? undefined : 'Set VALOR_APP_ID + VALOR_APP_KEY (Valor Pay) or STRIPE_SECRET_KEY in backend/.env';
    res.status(500).json({
      error: error.message || 'Revenue sync failed',
      hint,
    });
  }
});

router.get('/revenue/status', authenticateToken, async (req, res) => {
  try {
    const processor = getActiveProcessor();
    const summary = await db.getAsync(
      `SELECT COUNT(*) as total_days, SUM(revenue) as total_revenue, MAX(synced_at) as last_sync
       FROM processor_daily_revenue WHERE processor = ?`,
      [processor]
    );
    const daily = await db.allAsync(
      `SELECT date, revenue, charge_count, refund_total, synced_at
       FROM processor_daily_revenue WHERE processor = ? ORDER BY date DESC LIMIT 90`,
      [processor]
    );
    res.json({
      processor,
      total_days: summary?.total_days || 0,
      total_revenue: summary?.total_revenue || 0,
      last_sync: summary?.last_sync || null,
      daily: daily || [],
    });
  } catch (error) {
    console.error('Payment processor revenue status error:', error);
    res.status(500).json({ error: 'Failed to get revenue status' });
  }
});

// ─── Webhook (no auth; must be mounted with express.raw() for Stripe signature) ───
// Mount this handler in server.js on a route that uses express.raw() for the body.

export async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const rawBody = req.body; // Buffer when using express.raw()
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    return res.status(400).send('Missing body');
  }
  const payload = rawBody.toString('utf8');
  const event = await verifyStripeWebhook(payload, sig);
  if (!event) {
    return res.status(400).send('Invalid signature or missing STRIPE_WEBHOOK_SECRET');
  }

  try {
    if (event.type === 'charge.succeeded' || event.type === 'charge.captured') {
      const charge = event.data?.object;
      if (charge?.created) {
        const date = new Date(charge.created * 1000).toISOString().slice(0, 10);
        await syncStripeRevenue(date, date);
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data?.object;
      if (charge?.created) {
        const date = new Date(charge.created * 1000).toISOString().slice(0, 10);
        await syncStripeRevenue(date, date);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    res.status(500).json({ received: false, error: err.message });
  }
}

export default router;

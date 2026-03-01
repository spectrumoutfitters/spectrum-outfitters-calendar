import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import db from '../database/db.js';
import { getPaymentsByDateRange, aggregatePaymentsByDay } from '../utils/shopmonkey.js';

const router = express.Router();

// In-memory cache (5 min TTL)
let revenueCache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

router.get('/today-revenue', authenticateToken, requireAdmin, async (req, res) => {
  const now = Date.now();
  if (revenueCache.data && now - revenueCache.fetchedAt < CACHE_TTL_MS) {
    return res.json(revenueCache.data);
  }

  try {
    // Today's date in Houston timezone (America/Chicago)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

    // First: check the synced daily revenue table (background job keeps it fresh)
    const row = await db.getAsync(
      'SELECT revenue, charge_count FROM shopmonkey_daily_revenue WHERE date = ?',
      [todayStr]
    );

    let data;
    if (row) {
      data = { total_revenue: row.revenue || 0, invoice_count: row.charge_count || 0, currency: 'USD' };
    } else {
      // Fallback: fetch directly from ShopMonkey API
      const apiKey = process.env.SHOPMONKEY_API_KEY;
      if (!apiKey || apiKey === 'your_shopmonkey_api_key_here') {
        data = { total_revenue: 0, invoice_count: 0, currency: 'USD' };
      } else {
        const payments = await getPaymentsByDateRange(todayStr, todayStr);
        const aggregated = aggregatePaymentsByDay(payments);
        const todayData = aggregated.find(d => d.date === todayStr);
        data = {
          total_revenue: todayData?.revenue || 0,
          invoice_count: todayData?.charge_count || 0,
          currency: 'USD',
        };
      }
    }

    revenueCache = { data, fetchedAt: now };
    res.json(data);
  } catch (err) {
    console.warn('dashboard today-revenue error:', err.message);
    res.json({ total_revenue: 0, invoice_count: 0, error: true, currency: 'USD' });
  }
});

export default router;

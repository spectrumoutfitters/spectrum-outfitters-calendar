import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import db from '../database/db.js';
import { getPaymentsByDateRange, aggregatePaymentsByDay } from '../utils/shopmonkey.js';
import {
  errorRevenuePayload,
  houstonTodayDateString,
  isRevenueCacheFresh,
  isShopMonkeyApiKeyMissing,
  mapAggregatedTodayRevenue,
  mapSyncedDailyRevenue,
  zeroRevenuePayload,
} from '../utils/dashboardRevenueMath.js';

const router = express.Router();

// In-memory cache (5 min TTL)
let revenueCache = { data: null, fetchedAt: 0 };

router.get('/today-revenue', authenticateToken, requireAdmin, async (req, res) => {
  const now = Date.now();
  if (isRevenueCacheFresh(revenueCache, now)) {
    return res.json(revenueCache.data);
  }

  try {
    // Today's date in Houston timezone (America/Chicago)
    const todayStr = houstonTodayDateString();

    // First: check the synced daily revenue table (background job keeps it fresh)
    const row = await db.getAsync(
      'SELECT revenue, charge_count FROM shopmonkey_daily_revenue WHERE date = ?',
      [todayStr]
    );

    let data;
    if (row) {
      data = mapSyncedDailyRevenue(row);
    } else {
      // Fallback: fetch directly from ShopMonkey API
      const apiKey = process.env.SHOPMONKEY_API_KEY;
      if (isShopMonkeyApiKeyMissing(apiKey)) {
        data = zeroRevenuePayload();
      } else {
        const payments = await getPaymentsByDateRange(todayStr, todayStr);
        const aggregated = aggregatePaymentsByDay(payments);
        data = mapAggregatedTodayRevenue(aggregated, todayStr);
      }
    }

    revenueCache = { data, fetchedAt: now };
    res.json(data);
  } catch (err) {
    console.warn('dashboard today-revenue error:', err.message);
    res.json(errorRevenuePayload());
  }
});

export default router;

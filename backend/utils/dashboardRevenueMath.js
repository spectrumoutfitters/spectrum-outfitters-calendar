/**
 * Today's ShopMonkey revenue widget: Houston calendar date, 5-minute cache, and zero fallbacks.
 */

export const REVENUE_CACHE_TTL_MS = 5 * 60 * 1000;

export function isRevenueCacheFresh(cache, nowMs) {
  return !!(cache?.data && nowMs - cache.fetchedAt < REVENUE_CACHE_TTL_MS);
}

/** YYYY-MM-DD in America/Chicago via en-CA (same as the route). */
export function houstonTodayDateString(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

export function mapSyncedDailyRevenue(row) {
  return {
    total_revenue: row.revenue || 0,
    invoice_count: row.charge_count || 0,
    currency: 'USD',
  };
}

export function isShopMonkeyApiKeyMissing(apiKey) {
  return !apiKey || apiKey === 'your_shopmonkey_api_key_here';
}

export function mapAggregatedTodayRevenue(aggregated, todayStr) {
  const todayData = (aggregated || []).find((d) => d.date === todayStr);
  return {
    total_revenue: todayData?.revenue || 0,
    invoice_count: todayData?.charge_count || 0,
    currency: 'USD',
  };
}

export function zeroRevenuePayload() {
  return { total_revenue: 0, invoice_count: 0, currency: 'USD' };
}

export function errorRevenuePayload() {
  return { total_revenue: 0, invoice_count: 0, error: true, currency: 'USD' };
}

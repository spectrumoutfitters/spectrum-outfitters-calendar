import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVENUE_CACHE_TTL_MS,
  isRevenueCacheFresh,
  houstonTodayDateString,
  mapSyncedDailyRevenue,
  isShopMonkeyApiKeyMissing,
  mapAggregatedTodayRevenue,
  zeroRevenuePayload,
  errorRevenuePayload,
} from '../utils/dashboardRevenueMath.js';

describe('isRevenueCacheFresh', () => {
  it('requires data and a fetchedAt strictly inside the 5-minute TTL', () => {
    const now = 1_000_000;
    assert.equal(isRevenueCacheFresh({ data: null, fetchedAt: 0 }, now), false);
    assert.equal(isRevenueCacheFresh({ data: { total_revenue: 1 }, fetchedAt: now }, now), true);
    assert.equal(
      isRevenueCacheFresh({ data: { total_revenue: 1 }, fetchedAt: now - REVENUE_CACHE_TTL_MS + 1 }, now),
      true
    );
    assert.equal(
      isRevenueCacheFresh({ data: { total_revenue: 1 }, fetchedAt: now - REVENUE_CACHE_TTL_MS }, now),
      false
    );
    assert.equal(isRevenueCacheFresh(undefined, now), false);
  });
});

describe('houstonTodayDateString', () => {
  it('uses America/Chicago, so UTC midnight-to-5am in August is still the prior Houston date', () => {
    assert.equal(houstonTodayDateString(new Date('2026-08-21T05:00:00.000Z')), '2026-08-21');
    assert.equal(houstonTodayDateString(new Date('2026-08-21T04:59:59.000Z')), '2026-08-20');
    // CST (UTC-6) in January
    assert.equal(houstonTodayDateString(new Date('2026-01-15T06:00:00.000Z')), '2026-01-15');
    assert.equal(houstonTodayDateString(new Date('2026-01-15T05:59:59.000Z')), '2026-01-14');
  });
});

describe('mapSyncedDailyRevenue / mapAggregatedTodayRevenue', () => {
  it('coerces falsy revenue/count to 0; keeps negatives; missing day is zeros', () => {
    assert.deepEqual(mapSyncedDailyRevenue({ revenue: 12.5, charge_count: 3 }), {
      total_revenue: 12.5,
      invoice_count: 3,
      currency: 'USD',
    });
    assert.deepEqual(mapSyncedDailyRevenue({ revenue: 0, charge_count: 0 }), {
      total_revenue: 0,
      invoice_count: 0,
      currency: 'USD',
    });
    assert.deepEqual(mapSyncedDailyRevenue({ revenue: null, charge_count: undefined }), {
      total_revenue: 0,
      invoice_count: 0,
      currency: 'USD',
    });
    assert.deepEqual(mapSyncedDailyRevenue({ revenue: -4, charge_count: 1 }), {
      total_revenue: -4,
      invoice_count: 1,
      currency: 'USD',
    });

    assert.deepEqual(
      mapAggregatedTodayRevenue([{ date: '2026-08-21', revenue: 80, charge_count: 2 }], '2026-08-21'),
      { total_revenue: 80, invoice_count: 2, currency: 'USD' }
    );
    assert.deepEqual(mapAggregatedTodayRevenue([], '2026-08-21'), {
      total_revenue: 0,
      invoice_count: 0,
      currency: 'USD',
    });
    assert.deepEqual(mapAggregatedTodayRevenue(null, '2026-08-21'), {
      total_revenue: 0,
      invoice_count: 0,
      currency: 'USD',
    });
  });
});

describe('isShopMonkeyApiKeyMissing / payloads', () => {
  it('treats empty and placeholder keys as missing; other strings are configured', () => {
    assert.equal(isShopMonkeyApiKeyMissing(undefined), true);
    assert.equal(isShopMonkeyApiKeyMissing(''), true);
    assert.equal(isShopMonkeyApiKeyMissing('your_shopmonkey_api_key_here'), true);
    assert.equal(isShopMonkeyApiKeyMissing('sk_live_abc'), false);
    assert.equal(isShopMonkeyApiKeyMissing('0'), false);
  });

  it('zero vs error payloads share zeros; only the error path sets error: true', () => {
    assert.deepEqual(zeroRevenuePayload(), { total_revenue: 0, invoice_count: 0, currency: 'USD' });
    assert.deepEqual(errorRevenuePayload(), {
      total_revenue: 0,
      invoice_count: 0,
      error: true,
      currency: 'USD',
    });
  });
});

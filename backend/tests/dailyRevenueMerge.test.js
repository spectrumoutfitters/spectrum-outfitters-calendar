import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeDailyRevenueByPrecedence,
  resolveDailyRevenueSource,
  expectedSplitReimbursementThisWeek,
  pnlOperatingNet,
  pnlNetIncludingBank,
  pnlWeekOverWeekChangePercent,
} from '../utils/dailyRevenueMerge.js';

describe('mergeDailyRevenueByPrecedence', () => {
  it('prefers ShopMonkey over processor and manual on the same day (never sums)', () => {
    const { daily, total } = mergeDailyRevenueByPrecedence(
      { '2026-08-03': 100 },
      { '2026-08-03': 50 },
      { '2026-08-03': 25 }
    );
    assert.equal(daily.length, 1);
    assert.deepEqual(daily[0], { date: '2026-08-03', revenue: 100, source: 'shopmonkey' });
    assert.equal(total, 100);
  });

  it('falls back to processor when ShopMonkey is absent, then manual', () => {
    const { daily, total } = mergeDailyRevenueByPrecedence(
      {},
      { '2026-08-03': 40, '2026-08-04': 10 },
      { '2026-08-04': 99, '2026-08-05': 7 }
    );
    assert.deepEqual(daily, [
      { date: '2026-08-03', revenue: 40, source: 'processor' },
      { date: '2026-08-04', revenue: 10, source: 'processor' },
      { date: '2026-08-05', revenue: 7, source: 'manual' },
    ]);
    assert.equal(total, 57);
  });

  it('treats ShopMonkey zero as present (still wins precedence)', () => {
    const { daily, total } = mergeDailyRevenueByPrecedence(
      { '2026-08-03': 0 },
      { '2026-08-03': 80 },
      { '2026-08-03': 80 }
    );
    assert.equal(daily[0].source, 'shopmonkey');
    assert.equal(daily[0].revenue, 0);
    assert.equal(total, 0);
  });

  it('reads revenue from manual objects used by compliance P&L', () => {
    const { daily, total } = mergeDailyRevenueByPrecedence(
      {},
      {},
      { '2026-08-03': { revenue: 12.5, credit_cards: 12.5 } }
    );
    assert.equal(daily[0].revenue, 12.5);
    assert.equal(daily[0].source, 'manual');
    assert.equal(total, 12.5);
  });

  it('handles null/empty maps', () => {
    assert.deepEqual(mergeDailyRevenueByPrecedence(null, undefined, null), { daily: [], total: 0 });
  });
});

describe('resolveDailyRevenueSource', () => {
  it('returns null when the date is missing from all maps', () => {
    assert.equal(resolveDailyRevenueSource('2026-08-03', {}, {}, {}), null);
  });

  it('mirrors precedence for source labels', () => {
    assert.equal(
      resolveDailyRevenueSource('d', { d: 1 }, { d: 2 }, { d: 3 }),
      'shopmonkey'
    );
    assert.equal(resolveDailyRevenueSource('d', {}, { d: 2 }, { d: 3 }), 'processor');
    assert.equal(resolveDailyRevenueSource('d', {}, {}, { d: 3 }), 'manual');
  });
});

describe('expectedSplitReimbursementThisWeek', () => {
  it('sums weekly amounts and prorates monthly by 4.33', () => {
    const total = expectedSplitReimbursementThisWeek([
      { split_reimbursable_amount: 100, split_reimbursable_period: 'weekly' },
      { split_reimbursable_amount: 433, split_reimbursable_period: 'monthly' },
      { split_reimbursable_amount: 0, split_reimbursable_period: 'weekly' },
      { split_reimbursable_amount: 50 }, // default weekly
    ]);
    assert.ok(Math.abs(total - (100 + 433 / 4.33 + 50)) < 1e-9);
  });
});

describe('pnl net + WoW helpers', () => {
  it('separates operating net from bank-inclusive net', () => {
    assert.equal(pnlOperatingNet(1000, 400, 100), 500);
    assert.equal(pnlNetIncludingBank(1000, 400, 100, 50), 450);
  });

  it('computes WoW percent and returns 0 when previous net is 0', () => {
    assert.equal(pnlWeekOverWeekChangePercent(150, 100), 50);
    assert.equal(pnlWeekOverWeekChangePercent(50, -100), 150);
    assert.equal(pnlWeekOverWeekChangePercent(10, 0), 0);
  });
});

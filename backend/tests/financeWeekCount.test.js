import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CASH_FLOW_WEEKS_DEFAULT,
  FORECAST_HISTORY_DEFAULT,
  FORECAST_PROJECT_DEFAULT,
  parseFinanceWeekCount,
} from '../utils/financeWeekCount.js';

describe('parseFinanceWeekCount', () => {
  it('falls back on missing / empty / non-numeric (parseInt → NaN)', () => {
    assert.equal(parseFinanceWeekCount(undefined, 12), 12);
    assert.equal(parseFinanceWeekCount(null, 12), 12);
    assert.equal(parseFinanceWeekCount('', 12), 12);
    assert.equal(parseFinanceWeekCount('   ', 8), 8);
    assert.equal(parseFinanceWeekCount('abc', 12), 12);
    assert.equal(parseFinanceWeekCount(true, 12), 12);
  });

  it('treats numeric 0 and string "0" as missing via || fallback', () => {
    assert.equal(parseFinanceWeekCount(0, 12), 12);
    assert.equal(parseFinanceWeekCount('0', 12), 12);
    assert.equal(parseFinanceWeekCount('0', 8), 8);
  });

  it('keeps parseInt prefix / integers; does not clamp negatives or huge values', () => {
    assert.equal(parseFinanceWeekCount('12', 12), 12);
    assert.equal(parseFinanceWeekCount(4, 12), 4);
    assert.equal(parseFinanceWeekCount('12.9', 12), 12);
    assert.equal(parseFinanceWeekCount('  8', 12), 8);
    assert.equal(parseFinanceWeekCount('8weeks', 12), 8);
    assert.equal(parseFinanceWeekCount('-5', 12), -5);
    assert.equal(parseFinanceWeekCount('999999', 12), 999999);
  });

  it('uses the cash-flow / forecast shipped defaults', () => {
    assert.equal(CASH_FLOW_WEEKS_DEFAULT, 12);
    assert.equal(FORECAST_HISTORY_DEFAULT, 12);
    assert.equal(FORECAST_PROJECT_DEFAULT, 8);
    assert.equal(parseFinanceWeekCount(undefined, CASH_FLOW_WEEKS_DEFAULT), 12);
    assert.equal(parseFinanceWeekCount('0', FORECAST_PROJECT_DEFAULT), 8);
  });
});

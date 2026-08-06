import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPeriodLabel,
  getPeriodsToGenerate,
  getMissingDays
} from '../utils/compliancePeriods.js';

describe('getPeriodLabel', () => {
  it('labels monthly periods by month and year', () => {
    assert.equal(
      getPeriodLabel({ frequency: 'monthly' }, '2026-03-01', '2026-03-31'),
      'March 2026'
    );
  });

  it('labels quarterly periods from period end month', () => {
    assert.equal(
      getPeriodLabel({ frequency: 'quarterly' }, '2026-01-01', '2026-03-31'),
      'Q1 2026'
    );
    assert.equal(
      getPeriodLabel({ frequency: 'quarterly' }, '2026-04-01', '2026-06-30'),
      'Q2 2026'
    );
    assert.equal(
      getPeriodLabel({ frequency: 'quarterly' }, '2026-07-01', '2026-09-30'),
      'Q3 2026'
    );
    assert.equal(
      getPeriodLabel({ frequency: 'quarterly' }, '2026-10-01', '2026-12-31'),
      'Q4 2026'
    );
  });

  it('labels annual periods by end year and falls back for unknown frequency', () => {
    assert.equal(
      getPeriodLabel({ frequency: 'annual' }, '2025-01-01', '2025-12-31'),
      '2025'
    );
    assert.equal(
      getPeriodLabel({ frequency: 'weekly' }, '2026-08-01', '2026-08-07'),
      '2026-08-01 - 2026-08-07'
    );
  });
});

describe('getPeriodsToGenerate', () => {
  it('monthly includes previous, current, and next month around mid-month', () => {
    const periods = getPeriodsToGenerate({ frequency: 'monthly' }, '2026-08-15');
    assert.deepEqual(periods, [
      { start: '2026-08-01', end: '2026-08-31' },
      { start: '2026-07-01', end: '2026-07-31' },
      { start: '2026-09-01', end: '2026-09-30' }
    ]);
  });

  it('monthly handles January year rollover for previous/next', () => {
    const periods = getPeriodsToGenerate({ frequency: 'monthly' }, '2026-01-10');
    assert.deepEqual(periods, [
      { start: '2026-01-01', end: '2026-01-31' },
      { start: '2025-12-01', end: '2025-12-31' },
      { start: '2026-02-01', end: '2026-02-28' }
    ]);
  });

  it('quarterly includes current and previous quarter across year boundary', () => {
    const q1 = getPeriodsToGenerate({ frequency: 'quarterly' }, '2026-02-01');
    assert.deepEqual(q1, [
      { start: '2026-01-01', end: '2026-03-31' },
      { start: '2025-10-01', end: '2025-12-31' }
    ]);

    const q3 = getPeriodsToGenerate({ frequency: 'quarterly' }, '2026-08-06');
    assert.deepEqual(q3, [
      { start: '2026-07-01', end: '2026-09-30' },
      { start: '2026-04-01', end: '2026-06-30' }
    ]);
  });

  it('annual includes current and previous calendar years', () => {
    const periods = getPeriodsToGenerate({ frequency: 'annual' }, '2026-08-06');
    assert.deepEqual(periods, [
      { start: '2026-01-01', end: '2026-12-31' },
      { start: '2025-01-01', end: '2025-12-31' }
    ]);
  });

  it('returns empty for unknown frequency', () => {
    assert.deepEqual(getPeriodsToGenerate({ frequency: 'weekly' }, '2026-08-06'), []);
  });
});

describe('getMissingDays', () => {
  it('lists Houston calendar days absent from existingDates', () => {
    assert.deepEqual(
      getMissingDays('2026-08-03', '2026-08-07', ['2026-08-03', '2026-08-05', '2026-08-07']),
      ['2026-08-04', '2026-08-06']
    );
  });

  it('treats null existingDates as all missing', () => {
    assert.deepEqual(getMissingDays('2026-08-03', '2026-08-04', null), [
      '2026-08-03',
      '2026-08-04'
    ]);
  });

  it('returns empty when every day is present', () => {
    assert.deepEqual(
      getMissingDays('2026-08-03', '2026-08-04', ['2026-08-03', '2026-08-04']),
      []
    );
  });
});

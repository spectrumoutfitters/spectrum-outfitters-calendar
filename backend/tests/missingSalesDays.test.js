import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { addDaysInHouston } from '../utils/appTimezone.js';

// compliance.js starts the admin router and opens the database. Execute only
// getMissingDays, with the real Houston day stepper it already calls.
const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../routes/compliance.js'),
  'utf8'
);
const start = source.indexOf('function getMissingDays(weekStart, weekEnd, existingDates) {');
const end = source.indexOf('\n// GET /api/compliance/pnl/weeks', start);
if (start < 0 || end < 0) {
  throw new Error('getMissingDays slice markers moved in compliance.js');
}
const getMissingDays = new Function(
  'addDaysInHouston',
  `${source.slice(start, end)}\nreturn getMissingDays;`
)(addDaysInHouston);

describe('getMissingDays', { timeout: 2000 }, () => {
  it('lists shop-week gaps in order and ignores duplicate or out-of-window dates', () => {
    const missing = getMissingDays('2026-03-02', '2026-03-06', [
      '2026-03-02',
      '2026-03-02',
      '2026-03-04',
      '2026-03-07',
      '03/03/2026',
    ]);

    assert.deepEqual(missing, ['2026-03-03', '2026-03-05', '2026-03-06']);
  });

  it('treats a missing sales list as every day in the window', () => {
    assert.deepEqual(getMissingDays('2026-03-02', '2026-03-06', null), [
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
    ]);
  });

  it('covers a one-day window and a reversed window', () => {
    assert.deepEqual(getMissingDays('2026-03-04', '2026-03-04', []), ['2026-03-04']);
    assert.deepEqual(getMissingDays('2026-03-04', '2026-03-04', ['2026-03-04']), []);
    assert.deepEqual(getMissingDays('2026-03-06', '2026-03-02', []), []);
  });

  it('keeps calendar days across a month boundary and a year boundary', () => {
    assert.deepEqual(
      getMissingDays('2026-03-30', '2026-04-03', ['2026-03-31', '2026-04-02']),
      ['2026-03-30', '2026-04-01', '2026-04-03']
    );
    assert.deepEqual(
      getMissingDays('2026-12-31', '2027-01-02', ['2027-01-01']),
      ['2026-12-31', '2027-01-02']
    );
  });

  it('does not skip or repeat a calendar day across Houston daylight-saving changes', () => {
    // 2026-03-08 is the spring-forward Sunday. 2026-11-01 is the fall-back Sunday.
    assert.deepEqual(getMissingDays('2026-03-07', '2026-03-09', []), [
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
    ]);
    assert.deepEqual(getMissingDays('2026-10-31', '2026-11-02', ['2026-11-01']), [
      '2026-10-31',
      '2026-11-02',
    ]);
  });
});

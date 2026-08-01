import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysDateOnly,
  eventToScheduleDates,
  isShopClosedEvent,
  parseTypeFromSummary,
  shouldSyncEntryToGoogle,
  toDateOnly
} from '../utils/googleCalendarScheduleSync.js';

describe('toDateOnly / addDaysDateOnly', () => {
  it('keeps YYYY-MM-DD prefix from date or ISO strings', () => {
    assert.equal(toDateOnly('2026-07-15'), '2026-07-15');
    assert.equal(toDateOnly('2026-07-15T18:30:00.000Z'), '2026-07-15');
    assert.equal(toDateOnly(null), null);
  });

  it('adds and subtracts UTC calendar days', () => {
    assert.equal(addDaysDateOnly('2026-07-15', 1), '2026-07-16');
    assert.equal(addDaysDateOnly('2026-07-01', -1), '2026-06-30');
  });
});

describe('eventToScheduleDates', () => {
  it('converts exclusive all-day Google end into inclusive schedule end', () => {
    assert.deepEqual(
      eventToScheduleDates({
        start: { date: '2026-07-10' },
        end: { date: '2026-07-13' }
      }),
      { start_date: '2026-07-10', end_date: '2026-07-12' }
    );
  });

  it('collapses timed events to date-only range', () => {
    assert.deepEqual(
      eventToScheduleDates({
        start: { dateTime: '2026-07-10T15:00:00.000Z' },
        end: { dateTime: '2026-07-11T01:00:00.000Z' }
      }),
      { start_date: '2026-07-10', end_date: '2026-07-11' }
    );
  });
});

describe('parseTypeFromSummary / isShopClosedEvent', () => {
  it('classifies common leave labels from summary text', () => {
    assert.equal(parseTypeFromSummary('[SO] Alex - Vacation'), 'vacation');
    assert.equal(parseTypeFromSummary('Sick day'), 'sick_leave');
    assert.equal(parseTypeFromSummary('OOO Friday'), 'out_of_office');
    assert.equal(parseTypeFromSummary('Team standup'), 'other');
  });

  it('detects shop-closed markers in summary or description', () => {
    assert.equal(isShopClosedEvent('[SO] Shop Closed - Holiday', ''), true);
    assert.equal(isShopClosedEvent('Holiday', 'Shop closed all day'), true);
    assert.equal(isShopClosedEvent('Vacation', 'Personal leave'), false);
  });
});

describe('shouldSyncEntryToGoogle', () => {
  it('skips pending and time-off-request entries', () => {
    assert.equal(shouldSyncEntryToGoogle(null), false);
    assert.equal(shouldSyncEntryToGoogle({ status: 'pending', type: 'vacation' }), false);
    assert.equal(
      shouldSyncEntryToGoogle({ status: 'approved', type: 'time_off_request' }),
      false
    );
    assert.equal(
      shouldSyncEntryToGoogle({ status: 'approved', type: 'vacation' }),
      true
    );
  });
});

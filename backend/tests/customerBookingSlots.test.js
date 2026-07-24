import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DateTime } from 'luxon';
import {
  generateCandidateSlotsUtc,
  isOfferedBookingSlot
} from '../utils/customerBookingService.js';

const WEEKDAY_HOURS = {
  '1': [{ start: '08:00', end: '17:00' }],
  '2': [{ start: '08:00', end: '17:00' }],
  '3': [{ start: '08:00', end: '17:00' }],
  '4': [{ start: '08:00', end: '17:00' }],
  '5': [{ start: '08:00', end: '17:00' }],
  '6': [],
  '7': []
};

describe('customer booking offered-slot gate', () => {
  it('includes Mon–Fri shop-hour candidates and rejects weekend / overnight gaps', () => {
    // Monday 2026-07-06 in America/Chicago
    const now = DateTime.fromObject(
      { year: 2026, month: 7, day: 6, hour: 7, minute: 0 },
      { zone: 'America/Chicago' }
    );

    const candidates = generateCandidateSlotsUtc({
      timezone: 'America/Chicago',
      horizonDays: 7,
      slotMinutes: 30,
      weeklyHoursObj: WEEKDAY_HOURS,
      now
    });

    assert.ok(candidates.length > 0);

    const mondayOpen = DateTime.fromObject(
      { year: 2026, month: 7, day: 6, hour: 8, minute: 0 },
      { zone: 'America/Chicago' }
    );
    const mondayOpenEnd = mondayOpen.plus({ minutes: 30 });
    assert.equal(
      isOfferedBookingSlot({
        startMs: mondayOpen.toUTC().toMillis(),
        endMs: mondayOpenEnd.toUTC().toMillis(),
        candidates
      }),
      true
    );

    const saturdayNoon = DateTime.fromObject(
      { year: 2026, month: 7, day: 11, hour: 12, minute: 0 },
      { zone: 'America/Chicago' }
    );
    assert.equal(
      isOfferedBookingSlot({
        startMs: saturdayNoon.toUTC().toMillis(),
        endMs: saturdayNoon.plus({ minutes: 30 }).toUTC().toMillis(),
        candidates
      }),
      false
    );

    const mondayNight = DateTime.fromObject(
      { year: 2026, month: 7, day: 6, hour: 23, minute: 0 },
      { zone: 'America/Chicago' }
    );
    assert.equal(
      isOfferedBookingSlot({
        startMs: mondayNight.toUTC().toMillis(),
        endMs: mondayNight.plus({ minutes: 30 }).toUTC().toMillis(),
        candidates
      }),
      false
    );
  });

  it('rejects misaligned starts that are not on the slot grid', () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 7, day: 6, hour: 7, minute: 0 },
      { zone: 'America/Chicago' }
    );
    const candidates = generateCandidateSlotsUtc({
      timezone: 'America/Chicago',
      horizonDays: 2,
      slotMinutes: 30,
      weeklyHoursObj: WEEKDAY_HOURS,
      now
    });

    const oddStart = DateTime.fromObject(
      { year: 2026, month: 7, day: 6, hour: 8, minute: 7 },
      { zone: 'America/Chicago' }
    );
    assert.equal(
      isOfferedBookingSlot({
        startMs: oddStart.toUTC().toMillis(),
        endMs: oddStart.plus({ minutes: 30 }).toUTC().toMillis(),
        candidates
      }),
      false
    );
  });
});

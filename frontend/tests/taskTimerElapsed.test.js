import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateTaskTimerElapsedMs,
  formatTaskTimerElapsed,
  isTaskTimerLive,
} from '../src/utils/taskTimerElapsed.js';

const T0 = '2026-01-01T10:00:00.000Z';
const T30 = '2026-01-01T10:30:00.000Z';
const T60 = '2026-01-01T11:00:00.000Z';
const T90 = '2026-01-01T11:30:00.000Z';
const now = new Date('2026-01-01T12:00:00.000Z');

describe('isTaskTimerLive', () => {
  it('live only when no completed_at and status is not completed/review', () => {
    assert.equal(isTaskTimerLive({ started_at: T0, status: 'in_progress' }), true);
    assert.equal(isTaskTimerLive({ started_at: T0, status: 'todo' }), true);
    assert.equal(isTaskTimerLive({ started_at: T0, status: 'review' }), false);
    assert.equal(isTaskTimerLive({ started_at: T0, status: 'completed' }), false);
    assert.equal(isTaskTimerLive({ started_at: T0, completed_at: T60, status: 'in_progress' }), false);
  });
});

describe('calculateTaskTimerElapsedMs', () => {
  it('returns null without started_at', () => {
    assert.equal(calculateTaskTimerElapsedMs({}, now), null);
    assert.equal(calculateTaskTimerElapsedMs(null, now), null);
    assert.equal(calculateTaskTimerElapsedMs({ started_at: '' }, now), null);
  });

  it('uses completed_at when set; otherwise injectable now', () => {
    assert.equal(
      calculateTaskTimerElapsedMs({ started_at: T0, completed_at: T60 }, now),
      60 * 60 * 1000,
    );
    assert.equal(
      calculateTaskTimerElapsedMs({ started_at: T0 }, now),
      2 * 60 * 60 * 1000,
    );
  });

  it('skips breaks that start before started_at or after endTime (not clipped)', () => {
    const ms = calculateTaskTimerElapsedMs(
      {
        started_at: T30,
        completed_at: T90,
        breaks: [
          { break_start: T0, break_end: T30 },
          { break_start: '2026-01-01T12:00:00.000Z', break_end: '2026-01-01T12:10:00.000Z' },
        ],
      },
      now,
    );
    assert.equal(ms, 60 * 60 * 1000);
  });

  it('subtracts an in-window closed break and floors at 0', () => {
    const ms = calculateTaskTimerElapsedMs(
      {
        started_at: T0,
        completed_at: T60,
        breaks: [{ break_start: T30, break_end: T90 }],
      },
      now,
    );
    // 60m wall − 30m clamped break (T30→T60)
    assert.equal(ms, 30 * 60 * 1000);

    const overBreak = calculateTaskTimerElapsedMs(
      {
        started_at: T0,
        completed_at: T30,
        breaks: [{ break_start: T0, break_end: T90 }],
      },
      now,
    );
    assert.equal(overBreak, 0);
  });

  it('open break_end uses now only when active_break is truthy; else clamps to endTime', () => {
    const withFlag = calculateTaskTimerElapsedMs(
      {
        started_at: T0,
        completed_at: T90,
        active_break: { break_start: T60 },
        breaks: [{ break_start: T30 }],
      },
      now,
    );
    // open break T30 clamped to completed_at T90 (60m) + active_break T60→T90 (30m) = 90m → 0
    assert.equal(withFlag, 0);

    const noFlag = calculateTaskTimerElapsedMs(
      {
        started_at: T0,
        completed_at: T90,
        breaks: [{ break_start: T30 }],
      },
      now,
    );
    // open break without active_break → endTime (T30→T90 = 60m); 90 − 60 = 30m
    assert.equal(noFlag, 30 * 60 * 1000);
  });

  it('double-counts active_break when that interval is also listed in breaks', () => {
    const ms = calculateTaskTimerElapsedMs(
      {
        started_at: T0,
        completed_at: T90,
        active_break: { break_start: T60, break_end: T90 },
        breaks: [{ break_start: T60, break_end: T90 }],
      },
      now,
    );
    // 90m wall − 30m listed − 30m active_break again = 30m
    assert.equal(ms, 30 * 60 * 1000);
  });
});

describe('formatTaskTimerElapsed', () => {
  it('null stays null; formats H:MM and totalHours to 2 decimals', () => {
    assert.equal(formatTaskTimerElapsed(null), null);
    assert.deepEqual(formatTaskTimerElapsed(0), {
      totalMinutes: 0,
      totalHours: 0,
      formatted: '0:00',
      totalMs: 0,
    });
    assert.deepEqual(formatTaskTimerElapsed(90 * 60 * 1000), {
      totalMinutes: 90,
      totalHours: 1.5,
      formatted: '1:30',
      totalMs: 90 * 60 * 1000,
    });
  });
});

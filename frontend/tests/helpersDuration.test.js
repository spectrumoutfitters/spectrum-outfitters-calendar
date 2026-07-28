import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDuration,
  calculateDurationMinutes,
  calculateTotalDuration,
  formatDuration,
} from '../src/utils/helpers.js';

describe('formatDuration', () => {
  it('formats hours and minutes, including zero', () => {
    assert.equal(formatDuration(0), '0m');
    assert.equal(formatDuration(45), '45m');
    assert.equal(formatDuration(60), '1h 0m');
    assert.equal(formatDuration(90), '1h 30m');
  });

  it('returns an em dash for nullish non-zero-falsy values', () => {
    assert.equal(formatDuration(null), '—');
    assert.equal(formatDuration(undefined), '—');
  });
});

describe('calculateTotalDuration', () => {
  it('returns wall-clock span including breaks for a finished window', () => {
    assert.equal(
      calculateTotalDuration('2026-07-26T09:00:00.000Z', '2026-07-26T17:00:00.000Z'),
      '8h 0m',
    );
  });

  it('returns null without a start time', () => {
    assert.equal(calculateTotalDuration(null, '2026-07-26T17:00:00.000Z'), null);
  });

  it('returns null for inverted windows', () => {
    assert.equal(
      calculateTotalDuration('2026-07-26T17:00:00.000Z', '2026-07-26T09:00:00.000Z'),
      null,
    );
  });

  it('uses current time when end is missing for an in-progress task', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-26T11:00:00.000Z') });
    try {
      assert.equal(calculateTotalDuration('2026-07-26T09:00:00.000Z', null), '2h 0m');
    } finally {
      mock.timers.reset();
    }
  });
});

describe('calculateDuration / calculateDurationMinutes', () => {
  it('subtracts completed breaks from working time', () => {
    const start = '2026-07-26T09:00:00.000Z';
    const end = '2026-07-26T17:00:00.000Z';
    const breaks = [
      {
        break_start: '2026-07-26T12:00:00.000Z',
        break_end: '2026-07-26T12:30:00.000Z',
      },
    ];

    // 8h − 30m = 7h 30m
    assert.equal(calculateDuration(start, end, breaks), '7h 30m');
    assert.equal(calculateDurationMinutes(start, end, breaks), 450);
  });

  it('clamps break overlap to the task window', () => {
    const start = '2026-07-26T10:00:00.000Z';
    const end = '2026-07-26T11:00:00.000Z';
    const breaks = [
      {
        // starts before task, ends mid-task → only 15m overlaps
        break_start: '2026-07-26T09:45:00.000Z',
        break_end: '2026-07-26T10:15:00.000Z',
      },
    ];

    assert.equal(calculateDurationMinutes(start, end, breaks), 45);
    assert.equal(calculateDuration(start, end, breaks), '45m');
  });

  it('stops the working window at an active break start', () => {
    const start = '2026-07-26T09:00:00.000Z';
    const end = '2026-07-26T17:00:00.000Z';
    const activeBreak = { break_start: '2026-07-26T11:00:00.000Z' };

    // effective end becomes 11:00 → 2h working, no break subtraction needed
    assert.equal(calculateDuration(start, end, [], activeBreak), '2h 0m');
    assert.equal(calculateDurationMinutes(start, end, [], activeBreak), 120);
  });

  it('does not double-count an active break already present in breaks', () => {
    const start = '2026-07-26T09:00:00.000Z';
    const end = '2026-07-26T12:00:00.000Z';
    const activeBreak = { break_start: '2026-07-26T11:00:00.000Z' };
    const breaks = [activeBreak];

    // activeBreak sets effective end to 11:00 → 2h; break already counted via end clamp
    assert.equal(calculateDurationMinutes(start, end, breaks, activeBreak), 120);
  });

  it('counts unfinished breaks in the breaks array up to the effective end', () => {
    const start = '2026-07-26T09:00:00.000Z';
    const end = '2026-07-26T12:00:00.000Z';
    const breaks = [{ break_start: '2026-07-26T11:00:00.000Z' }];

    // 3h − 1h unfinished break = 2h
    assert.equal(calculateDurationMinutes(start, end, breaks), 120);
    assert.equal(calculateDuration(start, end, breaks), '2h 0m');
  });

  it('parses SQLite DATETIME strings as UTC', () => {
    const start = '2026-07-26 09:00:00';
    const end = '2026-07-26 10:30:00';
    assert.equal(calculateDurationMinutes(start, end), 90);
    assert.equal(calculateDuration(start, end), '1h 30m');
  });

  it('returns null / 0 without a start time', () => {
    assert.equal(calculateDuration(null, '2026-07-26T10:00:00.000Z'), null);
    assert.equal(calculateDurationMinutes(null, '2026-07-26T10:00:00.000Z'), 0);
  });

  it('clamps overlong breaks so working time never goes below zero', () => {
    const start = '2026-07-26T09:00:00.000Z';
    const end = '2026-07-26T10:00:00.000Z';
    const breaks = [
      {
        // extends past task end → clamped to the 1h task window
        break_start: '2026-07-26T09:00:00.000Z',
        break_end: '2026-07-26T12:00:00.000Z',
      },
    ];

    assert.equal(calculateDuration(start, end, breaks), '0m');
    assert.equal(calculateDurationMinutes(start, end, breaks), 0);
  });
});

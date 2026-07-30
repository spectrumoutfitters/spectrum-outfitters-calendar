import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { calculateElapsedTime } from '../src/utils/helpers.js';

describe('calculateElapsedTime', () => {
  it('formats backend totalElapsedMs into H:MM', () => {
    assert.equal(calculateElapsedTime('ignored', 0), '0:00');
    assert.equal(calculateElapsedTime(null, 90_000), '0:01');
    assert.equal(calculateElapsedTime(null, 3_660_000), '1:01');
    assert.equal(calculateElapsedTime(null, 36_000_000), '10:00');
  });

  it('falls back to wall clock from startTime when totalElapsedMs is omitted', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-30T15:30:00.000Z') });
    try {
      assert.equal(calculateElapsedTime('2026-07-30T14:00:00.000Z'), '1:30');
      assert.equal(calculateElapsedTime('2026-07-30T15:30:00.000Z'), '0:00');
    } finally {
      mock.timers.reset();
    }
  });

  it('returns 0:00 for missing startTime in fallback mode', () => {
    assert.equal(calculateElapsedTime(null), '0:00');
    assert.equal(calculateElapsedTime(''), '0:00');
  });

  it('prefers totalElapsedMs even when startTime is absent', () => {
    assert.equal(calculateElapsedTime(undefined, 125_000), '0:02');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDays } from '../src/utils/timeOffDays.js';

describe('calculateDays', () => {
  it('counts same-day requests as 1 day', () => {
    assert.equal(calculateDays('2026-08-08', '2026-08-08'), 1);
  });

  it('counts inclusive multi-day spans', () => {
    // Mon–Fri inclusive → 5
    assert.equal(calculateDays('2026-08-10', '2026-08-14'), 5);
  });

  it('uses absolute difference when end is before start', () => {
    assert.equal(calculateDays('2026-08-14', '2026-08-10'), 5);
  });

  it('accepts Date objects', () => {
    assert.equal(
      calculateDays(new Date('2026-08-08T00:00:00'), new Date('2026-08-09T00:00:00')),
      2
    );
  });
});

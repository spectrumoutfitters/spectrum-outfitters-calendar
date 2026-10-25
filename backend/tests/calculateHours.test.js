import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateHours } from '../utils/helpers.js';

describe('calculateHours', () => {
  it('returns null while the punch is still open', () => {
    assert.equal(calculateHours('2026-01-05T14:00:00.000Z', null), null);
    assert.equal(calculateHours('2026-01-05T14:00:00.000Z', undefined), null);
    assert.equal(calculateHours('2026-01-05T14:00:00.000Z', ''), null);
  });

  it('counts the full shift when no break is passed', () => {
    assert.equal(
      calculateHours('2026-01-05T14:00:00.000Z', '2026-01-05T22:00:00.000Z'),
      8,
    );
  });

  it('subtracts an unpaid break from paid hours', () => {
    assert.equal(
      calculateHours('2026-01-05T14:00:00.000Z', '2026-01-05T22:30:00.000Z', 30),
      8,
    );
    assert.equal(
      calculateHours('2026-01-05T14:00:00.000Z', '2026-01-05T22:00:00.000Z', 45),
      7.25,
    );
  });

  it('pays an overnight shift by elapsed time', () => {
    assert.equal(
      calculateHours('2026-01-05T22:30:00.000Z', '2026-01-06T06:00:00.000Z', 15),
      7.25,
    );
  });

  it('does not pay negative hours when clock-out is before clock-in', () => {
    assert.equal(
      calculateHours('2026-01-05T22:00:00.000Z', '2026-01-05T14:00:00.000Z', 0),
      0,
    );
  });

  it('does not pay hours when the break consumes the shift', () => {
    assert.equal(
      calculateHours('2026-01-05T14:00:00.000Z', '2026-01-05T14:30:00.000Z', 30),
      0,
    );
    assert.equal(
      calculateHours('2026-01-05T14:00:00.000Z', '2026-01-05T15:00:00.000Z', 90),
      0,
    );
  });

  it('pays elapsed time through the spring-forward gap, not the wall-clock labels', () => {
    // 1:30am CST to 3:30am CDT on 2026-03-08 is one hour of work. The labels span two hours.
    assert.equal(
      calculateHours('2026-03-08T07:30:00.000Z', '2026-03-08T08:30:00.000Z', 0),
      1,
    );
  });

  it('pays the repeated hour on fall-back', () => {
    // 1:00am CDT to 3:00am CST on 2026-11-01 includes the repeated hour, so it is three hours.
    assert.equal(
      calculateHours('2026-11-01T06:00:00.000Z', '2026-11-01T09:00:00.000Z', 0),
      3,
    );
  });
});

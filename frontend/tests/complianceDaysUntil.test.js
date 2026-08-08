import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDaysUntil } from '../src/utils/complianceDaysUntil.js';

describe('getDaysUntil', () => {
  // Local midnight for "today" so setHours(0,0,0,0) is stable across TZ.
  const now = new Date(2026, 7, 8, 15, 30, 0); // Aug 8, 2026 local

  it('returns negative days for overdue dates', () => {
    // YYYY-MM-DD via Date() is UTC midnight; ceil vs local today may vary by TZ.
    // Assert relative ordering vs a future date under the same clock.
    const overdue = getDaysUntil('2026-08-01', now);
    const future = getDaysUntil('2026-08-15', now);
    assert.ok(overdue < 0, `expected overdue < 0, got ${overdue}`);
    assert.ok(future > 0, `expected future > 0, got ${future}`);
    assert.ok(future > overdue);
  });

  it('returns 0 when due is today under UTC-midnight parse (when local TZ makes it so)', () => {
    // Document current parse: `new Date('YYYY-MM-DD')` → UTC midnight.
    const dueUtc = new Date('2026-08-08');
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const expected = Math.ceil((dueUtc - today) / (1000 * 60 * 60 * 24));
    assert.equal(getDaysUntil('2026-08-08', now), expected);
  });

  it('returns positive days for future due dates', () => {
    const dueUtc = new Date('2026-08-15');
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const expected = Math.ceil((dueUtc - today) / (1000 * 60 * 60 * 24));
    assert.equal(getDaysUntil('2026-08-15', now), expected);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countEmployeeStatusBar } from '../src/utils/employeeStatusBar.js';

describe('countEmployeeStatusBar', () => {
  it('counts clocked-in, lunch, and clocked-out independently', () => {
    const counts = countEmployeeStatusBar([
      { id: 1, clockedIn: true, onLunch: false, lastActivity: '2026-05-18T14:00:00Z' },
      { id: 2, clockedIn: false, onLunch: true, lastActivity: '2026-05-18T17:00:00Z' },
      { id: 3, clockedIn: false, onLunch: false, lastActivity: '2026-05-18T21:00:00Z' },
      { id: 4, clockedIn: false, onLunch: false, lastActivity: null, hoursWorkedToday: 6 },
    ]);

    assert.deepEqual(counts, {
      clockedIn: 1,
      onLunch: 1,
      clockedOut: 1,
      total: 4,
      active: 2,
    });
  });

  it('does not treat hoursWorkedToday alone as clocked out', () => {
    const counts = countEmployeeStatusBar([
      { id: 1, clockedIn: false, onLunch: false, lastActivity: null, hoursWorkedToday: 3.5 },
      { id: 2, clockedIn: false, onLunch: false, lastActivity: '', hoursWorkedToday: '0' },
    ]);

    assert.equal(counts.clockedOut, 0);
    assert.equal(counts.clockedIn, 0);
    assert.equal(counts.onLunch, 0);
    assert.equal(counts.total, 2);
    assert.equal(counts.active, 0);
  });

  it('counts a row with both flags in both badges and not as clocked out', () => {
    const counts = countEmployeeStatusBar([
      { id: 1, clockedIn: true, onLunch: true, lastActivity: '2026-05-18T17:00:00Z' },
    ]);

    assert.equal(counts.clockedIn, 1);
    assert.equal(counts.onLunch, 1);
    assert.equal(counts.clockedOut, 0);
    assert.equal(counts.active, 2);
  });

  it('returns zeros for a missing list', () => {
    assert.deepEqual(countEmployeeStatusBar(null), {
      clockedIn: 0,
      onLunch: 0,
      clockedOut: 0,
      total: 0,
      active: 0,
    });
  });
});

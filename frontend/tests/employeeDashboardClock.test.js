import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatBreakRemaining,
  formatElapsed,
  formatTaskDuration,
  shouldShowVacationHandoffChecklist,
  vacationCountdownHeadline,
} from '../src/utils/employeeDashboardClock.js';

describe('formatElapsed', () => {
  it('floors to minutes and shows hours once an hour has elapsed', () => {
    assert.equal(formatElapsed(0), '0m');
    assert.equal(formatElapsed(null), '0m');
    assert.equal(formatElapsed(-1), '0m');
    assert.equal(formatElapsed(59_000), '0m');
    assert.equal(formatElapsed(60_000), '1m');
    assert.equal(formatElapsed(59 * 60 * 1000), '59m');
    assert.equal(formatElapsed(60 * 60 * 1000), '1h 0m');
    assert.equal(formatElapsed((90 * 60 * 1000) + 999), '1h 30m');
  });
});

describe('formatBreakRemaining', () => {
  it('formats the break countdown as M:SS and clamps non-positive values', () => {
    assert.equal(formatBreakRemaining(0), '0:00');
    assert.equal(formatBreakRemaining(undefined), '0:00');
    assert.equal(formatBreakRemaining(-500), '0:00');
    assert.equal(formatBreakRemaining(5_000), '0:05');
    assert.equal(formatBreakRemaining(90_000), '1:30');
    assert.equal(formatBreakRemaining(125_999), '2:05');
  });
});

describe('formatTaskDuration', () => {
  it('returns null for a missing estimate and compact labels otherwise', () => {
    assert.equal(formatTaskDuration(0), null);
    assert.equal(formatTaskDuration(null), null);
    assert.equal(formatTaskDuration(undefined), null);
    assert.equal(formatTaskDuration(45), '45min');
    assert.equal(formatTaskDuration(60), '1h');
    assert.equal(formatTaskDuration(61), '1h 1m');
    assert.equal(formatTaskDuration(90), '1h 30m');
  });
});

describe('vacation handoff', () => {
  it('uses distinct copy for the start day and the day before', () => {
    assert.equal(vacationCountdownHeadline(0), 'Your time off starts today!');
    assert.equal(vacationCountdownHeadline(1), '1 day until your time off');
    assert.equal(vacationCountdownHeadline(2), '2 days until your time off');
    assert.equal(vacationCountdownHeadline(4), '4 days until your time off');
  });

  it('shows the handoff checklist through three days before time off, then hides it', () => {
    assert.equal(shouldShowVacationHandoffChecklist(0), true);
    assert.equal(shouldShowVacationHandoffChecklist(1), true);
    assert.equal(shouldShowVacationHandoffChecklist(3), true);
    assert.equal(shouldShowVacationHandoffChecklist(4), false);
    assert.equal(shouldShowVacationHandoffChecklist(10), false);
  });
});

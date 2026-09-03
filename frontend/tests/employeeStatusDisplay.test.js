import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyEmployeePresence,
  formatLastLogin,
  hasLongInactivity,
} from '../src/utils/employeeStatusDisplay.js';

describe('formatLastLogin', () => {
  it('treats falsy lastLogin as never (including numeric 0)', () => {
    assert.deepEqual(formatLastLogin(null, 0), { text: 'Never logged in', isWarning: true });
    assert.deepEqual(formatLastLogin('', 3), { text: 'Never logged in', isWarning: true });
    assert.deepEqual(formatLastLogin(0, 0), { text: 'Never logged in', isWarning: true });
  });

  it('uses strict === 0 / === 1; string days are not Today/Yesterday', () => {
    assert.deepEqual(formatLastLogin('2026-09-01', 0), { text: 'Today', isWarning: false });
    assert.deepEqual(formatLastLogin('2026-09-01', 1), { text: 'Yesterday', isWarning: false });
    assert.deepEqual(formatLastLogin('2026-09-01', '0'), { text: '0 days ago', isWarning: false });
    assert.deepEqual(formatLastLogin('2026-09-01', '1'), { text: '1 days ago', isWarning: false });
  });

  it('warns at >= 7 days and switches to months at >= 30', () => {
    assert.deepEqual(formatLastLogin('x', 6), { text: '6 days ago', isWarning: false });
    assert.deepEqual(formatLastLogin('x', 7), { text: '7 days ago', isWarning: true });
    assert.deepEqual(formatLastLogin('x', 29), { text: '29 days ago', isWarning: true });
    assert.deepEqual(formatLastLogin('x', 30), { text: '1 month ago', isWarning: true });
    assert.deepEqual(formatLastLogin('x', 59), { text: '1 month ago', isWarning: true });
    assert.deepEqual(formatLastLogin('x', 60), { text: '2 months ago', isWarning: true });
  });

  it('keeps negatives in the < 7 bucket (not warning)', () => {
    assert.deepEqual(formatLastLogin('x', -1), { text: '-1 days ago', isWarning: false });
  });

  it('computes floor days from lastLogin only when days is nullish', () => {
    const now = new Date('2026-09-03T12:00:00.000Z');
    const almostOneDay = new Date(now.getTime() - (23 * 60 * 60 * 1000)).toISOString();
    const justOverOneDay = new Date(now.getTime() - (25 * 60 * 60 * 1000)).toISOString();
    assert.deepEqual(formatLastLogin(almostOneDay, null, now), { text: 'Today', isWarning: false });
    assert.deepEqual(formatLastLogin(justOverOneDay, undefined, now), { text: 'Yesterday', isWarning: false });
    assert.deepEqual(formatLastLogin(justOverOneDay, 0, now), { text: 'Today', isWarning: false });
  });
});

describe('hasLongInactivity', () => {
  it('requires isWarning and raw daysSinceLogin >= 7 (string 7 coerces)', () => {
    assert.equal(hasLongInactivity({ isWarning: true }, 7), true);
    assert.equal(hasLongInactivity({ isWarning: true }, '7'), true);
    assert.equal(hasLongInactivity({ isWarning: true }, 6), false);
    assert.equal(hasLongInactivity({ isWarning: true }, null), false);
    assert.equal(hasLongInactivity({ isWarning: false }, 10), false);
  });
});

describe('classifyEmployeePresence', () => {
  it('lets clockedIn win over onLunch', () => {
    assert.equal(classifyEmployeePresence({ clockedIn: true, onLunch: true }), 'clocked_in');
  });

  it('treats 0 hours / empty lastActivity as off today; string 0 as clocked out', () => {
    assert.equal(classifyEmployeePresence({ hoursWorkedToday: 0 }), 'off_today');
    assert.equal(classifyEmployeePresence({ lastActivity: '' }), 'off_today');
    assert.equal(classifyEmployeePresence({ hoursWorkedToday: '0' }), 'clocked_out');
    assert.equal(classifyEmployeePresence({ lastActivity: '2026-09-03T10:00:00Z' }), 'clocked_out');
  });
});

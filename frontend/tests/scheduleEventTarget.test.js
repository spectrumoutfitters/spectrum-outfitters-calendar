import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyScheduleEventTarget } from '../src/utils/scheduleEventTarget.js';

describe('applyScheduleEventTarget', () => {
  it('leaves payload unchanged for non-admin or falsy target (including 0)', () => {
    const base = { type: 'meeting' };
    assert.equal(applyScheduleEventTarget(base, { isAdmin: false, targetUserId: 'user:9', adminUserId: 1 }), base);
    assert.deepEqual(base, { type: 'meeting' });
    assert.equal(applyScheduleEventTarget(base, { isAdmin: true, targetUserId: '', adminUserId: 1 }), base);
    assert.equal(applyScheduleEventTarget(base, { isAdmin: true, targetUserId: 0, adminUserId: 1 }), base);
    assert.equal(applyScheduleEventTarget(base, { isAdmin: true, targetUserId: null, adminUserId: 1 }), base);
  });

  it('maps gcal:* to google_calendar_id and owns the row as the admin', () => {
    const payload = { type: 'meeting' };
    applyScheduleEventTarget(payload, { isAdmin: true, targetUserId: 'gcal:cal-abc', adminUserId: 42 });
    assert.equal(payload.google_calendar_id, 'cal-abc');
    assert.equal(payload.user_id, 42);
  });

  it('maps empty gcal: prefix to empty calendar id still owned by admin', () => {
    const payload = {};
    applyScheduleEventTarget(payload, { isAdmin: true, targetUserId: 'gcal:', adminUserId: 7 });
    assert.equal(payload.google_calendar_id, '');
    assert.equal(payload.user_id, 7);
  });

  it('strips user: and Number()s the remainder (0 and NaN kept)', () => {
    const a = {};
    applyScheduleEventTarget(a, { isAdmin: true, targetUserId: 'user:12', adminUserId: 1 });
    assert.equal(a.user_id, 12);
    assert.equal(a.google_calendar_id, undefined);

    const zero = {};
    applyScheduleEventTarget(zero, { isAdmin: true, targetUserId: 'user:0', adminUserId: 1 });
    assert.equal(zero.user_id, 0);

    const empty = {};
    applyScheduleEventTarget(empty, { isAdmin: true, targetUserId: 'user:', adminUserId: 1 });
    assert.equal(empty.user_id, undefined);

    const raw = {};
    applyScheduleEventTarget(raw, { isAdmin: true, targetUserId: '99', adminUserId: 1 });
    assert.equal(raw.user_id, 99);

    const nan = {};
    applyScheduleEventTarget(nan, { isAdmin: true, targetUserId: 'user:abc', adminUserId: 1 });
    assert.ok(Number.isNaN(nan.user_id));
  });

  it('gcal: wins over a user: substring in the calendar id', () => {
    const payload = {};
    applyScheduleEventTarget(payload, { isAdmin: true, targetUserId: 'gcal:user:1', adminUserId: 3 });
    assert.equal(payload.google_calendar_id, 'user:1');
    assert.equal(payload.user_id, 3);
  });
});

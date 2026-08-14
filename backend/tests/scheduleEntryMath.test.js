import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEmployeesSeeAllSetting,
  employeesSeeAllToStoredValue,
  parseScheduleDateRange,
  dateRangesOverlap,
  isShopWideFlag,
  isEventFlag,
  resolveScheduleCreateTarget,
  resolveScheduleCreateTypeStatus,
} from '../utils/scheduleEntryMath.js';

describe('parseEmployeesSeeAllSetting', () => {
  it('treats only the strings 1 and true as enabled', () => {
    assert.equal(parseEmployeesSeeAllSetting('1'), true);
    assert.equal(parseEmployeesSeeAllSetting('true'), true);
    assert.equal(parseEmployeesSeeAllSetting(true), false);
    assert.equal(parseEmployeesSeeAllSetting(1), false);
    assert.equal(parseEmployeesSeeAllSetting('true '), false);
    assert.equal(parseEmployeesSeeAllSetting('TRUE'), false);
    assert.equal(parseEmployeesSeeAllSetting('0'), false);
    assert.equal(parseEmployeesSeeAllSetting('false'), false);
    assert.equal(parseEmployeesSeeAllSetting(undefined), false);
  });
});

describe('employeesSeeAllToStoredValue', () => {
  it('persists only boolean true or string true as 1', () => {
    assert.equal(employeesSeeAllToStoredValue(true), '1');
    assert.equal(employeesSeeAllToStoredValue('true'), '1');
    assert.equal(employeesSeeAllToStoredValue('1'), '0');
    assert.equal(employeesSeeAllToStoredValue(1), '0');
    assert.equal(employeesSeeAllToStoredValue(false), '0');
    assert.equal(employeesSeeAllToStoredValue('false'), '0');
    assert.equal(employeesSeeAllToStoredValue(undefined), '0');
  });
});

describe('parseScheduleDateRange', () => {
  it('requires both dates on create', () => {
    assert.deepEqual(parseScheduleDateRange('', '2026-08-10'), {
      error: 'start_date and end_date are required',
    });
    assert.deepEqual(parseScheduleDateRange('2026-08-10', null), {
      error: 'start_date and end_date are required',
    });
  });

  it('skips validation on update when either date is missing', () => {
    assert.deepEqual(parseScheduleDateRange('2026-08-10', undefined, { required: false }), {
      skip: true,
    });
    assert.deepEqual(parseScheduleDateRange(null, '2026-08-10', { required: false }), {
      skip: true,
    });
  });

  it('rejects unparseable dates and inverted ranges, but allows equal dates', () => {
    assert.deepEqual(parseScheduleDateRange('not-a-date', '2026-08-10'), {
      error: 'Invalid date format',
    });
    assert.deepEqual(parseScheduleDateRange('2026-08-12', '2026-08-10'), {
      error: 'end_date must be after start_date',
    });
    const same = parseScheduleDateRange('2026-08-10', '2026-08-10');
    assert.equal(same.error, undefined);
    assert.ok(same.start instanceof Date);
    assert.ok(same.end instanceof Date);
  });
});

describe('dateRangesOverlap', () => {
  it('detects interior, contained, and touching ranges', () => {
    assert.equal(dateRangesOverlap('2026-01-01', '2026-01-10', '2026-01-05', '2026-01-07'), true);
    assert.equal(dateRangesOverlap('2026-01-05', '2026-01-07', '2026-01-01', '2026-01-10'), true);
    assert.equal(dateRangesOverlap('2026-01-01', '2026-01-05', '2026-01-05', '2026-01-10'), true);
  });

  it('allows a gap of one day', () => {
    assert.equal(dateRangesOverlap('2026-01-01', '2026-01-05', '2026-01-06', '2026-01-10'), false);
  });
});

describe('isShopWideFlag / isEventFlag', () => {
  it('uses distinct truthiness (shop-wide ignores string true/1)', () => {
    assert.equal(isShopWideFlag(true), true);
    assert.equal(isShopWideFlag(1), true);
    assert.equal(isShopWideFlag('1'), false);
    assert.equal(isShopWideFlag('true'), false);

    assert.equal(isEventFlag(true), true);
    assert.equal(isEventFlag('true'), true);
    assert.equal(isEventFlag(1), true);
    assert.equal(isEventFlag('1'), false);
  });
});

describe('resolveScheduleCreateTarget', () => {
  it('blocks non-admins from shop-wide closed days', () => {
    const blocked = resolveScheduleCreateTarget({
      isAdmin: false,
      actorUserId: 7,
      user_id: 99,
      is_shop_wide: true,
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.error, 'Only admins can create shop-wide closed days');
  });

  it('lets admins create shop-wide rows with null user id', () => {
    assert.deepEqual(
      resolveScheduleCreateTarget({ isAdmin: true, actorUserId: 1, user_id: 9, is_shop_wide: 1 }),
      { shopWide: true, targetUserId: null },
    );
  });

  it('lets admins target another user, and forces employees onto themselves', () => {
    assert.deepEqual(
      resolveScheduleCreateTarget({ isAdmin: true, actorUserId: 1, user_id: 9, is_shop_wide: false }),
      { shopWide: false, targetUserId: 9 },
    );
    assert.deepEqual(
      resolveScheduleCreateTarget({ isAdmin: false, actorUserId: 7, user_id: 9, is_shop_wide: false }),
      { shopWide: false, targetUserId: 7 },
    );
  });
});

describe('resolveScheduleCreateTypeStatus', () => {
  it('defaults admin rows to scheduled day_off and employee rows to pending time_off_request', () => {
    assert.deepEqual(resolveScheduleCreateTypeStatus({ isAdmin: true }), {
      isEvent: false,
      entryType: 'day_off',
      entryStatus: 'scheduled',
    });
    assert.deepEqual(resolveScheduleCreateTypeStatus({ isAdmin: false }), {
      isEvent: false,
      entryType: 'time_off_request',
      entryStatus: 'pending',
    });
  });

  it('lets employees skip approval for known event types, mapping unknown types to meeting', () => {
    assert.deepEqual(
      resolveScheduleCreateTypeStatus({ isAdmin: false, type: 'training', is_event: true }),
      { isEvent: true, entryType: 'training', entryStatus: 'scheduled' },
    );
    assert.deepEqual(
      resolveScheduleCreateTypeStatus({ isAdmin: false, type: 'day_off', is_event: 'true' }),
      { isEvent: true, entryType: 'meeting', entryStatus: 'scheduled' },
    );
  });
});

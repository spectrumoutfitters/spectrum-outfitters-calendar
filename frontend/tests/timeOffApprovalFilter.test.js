import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterTimeApprovalRows,
  inclusiveCalendarDays,
  isTimeApprovalRow,
} from '../src/utils/timeOffApprovalFilter.js';

describe('isTimeApprovalRow', () => {
  it('includes time_off_request of any status and any pending type', () => {
    assert.equal(isTimeApprovalRow({ type: 'time_off_request', status: 'approved' }), true);
    assert.equal(isTimeApprovalRow({ type: 'time_off_request', status: 'rejected' }), true);
    assert.equal(isTimeApprovalRow({ type: 'day_off', status: 'pending' }), true);
    assert.equal(isTimeApprovalRow({ type: 'vacation', status: 'pending' }), true);
    assert.equal(isTimeApprovalRow({ type: 'day_off', status: 'approved' }), false);
    assert.equal(isTimeApprovalRow({ type: 'day_off', status: 'rejected' }), false);
    assert.equal(isTimeApprovalRow({}), false);
    assert.equal(isTimeApprovalRow(null), false);
  });
});

describe('filterTimeApprovalRows', () => {
  const entries = [
    { id: 'a', type: 'time_off_request', status: 'pending', start_date: '2026-09-03' },
    { id: 'b', type: 'time_off_request', status: 'approved', start_date: '2026-09-05' },
    { id: 'c', type: 'day_off', status: 'pending', start_date: '2026-09-01' },
    { id: 'd', type: 'day_off', status: 'approved', start_date: '2026-09-10' },
    { id: 'e', type: 'time_off_request', status: 'rejected', start_date: '2026-09-04' },
  ];

  it('defaults to pending chip: time_off_request pending + pending day_off; hides approved day_off', () => {
    assert.deepEqual(filterTimeApprovalRows(entries).map((r) => r.id), ['a', 'c']);
  });

  it('approved chip keeps approved time_off_request only (approved day_off stays hidden)', () => {
    assert.deepEqual(filterTimeApprovalRows(entries, 'approved').map((r) => r.id), ['b']);
  });

  it('all chip keeps every candidate, newest start_date first', () => {
    assert.deepEqual(filterTimeApprovalRows(entries, 'all').map((r) => r.id), ['b', 'e', 'a', 'c']);
  });

  it('status filter is exact — "Pending" does not match pending', () => {
    assert.deepEqual(filterTimeApprovalRows(entries, 'Pending').map((r) => r.id), []);
  });
});

describe('inclusiveCalendarDays', () => {
  it('same ISO date is 1; reversed range still counts; invalid dates are NaN', () => {
    assert.equal(inclusiveCalendarDays('2026-09-01', '2026-09-01'), 1);
    assert.equal(inclusiveCalendarDays('2026-09-01', '2026-09-07'), 7);
    assert.equal(inclusiveCalendarDays('2026-09-07', '2026-09-01'), 7);
    assert.ok(Number.isNaN(inclusiveCalendarDays('not-a-date', '2026-09-01')));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  payrollAccessFlags,
  payrollAccessRevokeBlock,
  isSafePayrollDataFilename,
  payrollEmployeeLookupKey,
  calendarEmployeeLookupKey,
  mergeCalendarPayrollEmployee,
  payrollWeekBoundsFromEndingDate,
  mapPayrollTimeEntry,
  groupPayrollTimeByUser,
  payrollHistoryInDateRange,
  sumPayrollHistoryTotals,
} from '../utils/payrollSyncMath.js';

describe('payrollAccessFlags', () => {
  it('grants access when payroll_access is 1', () => {
    assert.deepEqual(payrollAccessFlags({ payroll_access: 1, is_master_admin: 0 }), {
      hasAccess: true,
      isMasterAdmin: false,
      payrollAccess: true,
      isMaster: false,
    });
  });

  it('grants access for master admin even without payroll_access', () => {
    assert.deepEqual(payrollAccessFlags({ payroll_access: 0, is_master_admin: 1 }), {
      hasAccess: true,
      isMasterAdmin: true,
      payrollAccess: false,
      isMaster: true,
    });
  });

  it('denies access when both flags are off (truthy 2 is not treated as granted)', () => {
    assert.deepEqual(payrollAccessFlags({ payroll_access: 2, is_master_admin: 0 }), {
      hasAccess: false,
      isMasterAdmin: false,
      payrollAccess: false,
      isMaster: false,
    });
  });
});

describe('payrollAccessRevokeBlock', () => {
  it('blocks revoking a master admin', () => {
    const r = payrollAccessRevokeBlock({
      targetIsMasterAdmin: true,
      actorId: 1,
      targetId: '2',
      payroll_access: false,
    });
    assert.equal(r.blocked, true);
    assert.equal(r.error, 'Cannot remove payroll access from master admin');
  });

  it('blocks revoking your own access', () => {
    const r = payrollAccessRevokeBlock({
      targetIsMasterAdmin: false,
      actorId: 9,
      targetId: '9',
      payroll_access: false,
    });
    assert.equal(r.blocked, true);
    assert.equal(r.error, 'Cannot remove your own payroll access');
  });

  it('allows granting access even to self or master', () => {
    assert.equal(
      payrollAccessRevokeBlock({
        targetIsMasterAdmin: true,
        actorId: 1,
        targetId: '1',
        payroll_access: true,
      }).blocked,
      false
    );
  });

  it('does not treat 0 or "false" as a revoke (strict === false)', () => {
    assert.equal(
      payrollAccessRevokeBlock({
        targetIsMasterAdmin: true,
        actorId: 1,
        targetId: '1',
        payroll_access: 0,
      }).blocked,
      false
    );
    assert.equal(
      payrollAccessRevokeBlock({
        targetIsMasterAdmin: false,
        actorId: 1,
        targetId: '1',
        payroll_access: 'false',
      }).blocked,
      false
    );
  });
});

describe('isSafePayrollDataFilename', () => {
  it('allows a simple json filename', () => {
    assert.equal(isSafePayrollDataFilename('employees.json'), true);
    assert.equal(isSafePayrollDataFilename('vault-meta.json'), true);
  });

  it('rejects path separators and parent-directory segments', () => {
    assert.equal(isSafePayrollDataFilename('../employees.json'), false);
    assert.equal(isSafePayrollDataFilename('foo/bar.json'), false);
    assert.equal(isSafePayrollDataFilename('foo\\bar.json'), false);
  });

  it('rejects any filename containing ".." (current includes() check, not only traversal)', () => {
    assert.equal(isSafePayrollDataFilename('foo..bar.json'), false);
  });
});

describe('Calendar ↔ payroll employee merge', () => {
  it('matches by lowercased name, falling back to username', () => {
    assert.equal(payrollEmployeeLookupKey({ name: 'Ada Lovelace', username: 'ada' }), 'ada lovelace');
    assert.equal(payrollEmployeeLookupKey({ username: 'Ada' }), 'ada');
    assert.equal(calendarEmployeeLookupKey({ full_name: 'Ada Lovelace', username: 'ada' }), 'ada lovelace');
    assert.equal(calendarEmployeeLookupKey({ username: 'Ada' }), 'ada');
  });

  it('prefers Calendar rates but treats 0 as missing so payroll values fill in', () => {
    const merged = mergeCalendarPayrollEmployee(
      { id: 3, full_name: 'Pat', username: 'pat', email: null, hourly_rate: 0, weekly_salary: 0 },
      { hourlyRate: 22.5, weeklySalary: 900, taxInfo: { filing: 'single' }, deductions: [{ name: '401k' }], notes: 'keep' }
    );
    assert.equal(merged.hourlyRate, 22.5);
    assert.equal(merged.weeklySalary, 900);
    assert.equal(merged.email, '');
    assert.deepEqual(merged.taxInfo, { filing: 'single' });
    assert.equal(merged.notes, 'keep');
  });

  it('does not copy payroll-only fields when there is no existing row', () => {
    const merged = mergeCalendarPayrollEmployee(
      { id: 4, full_name: 'New', username: 'new', email: 'n@x', hourly_rate: 18, weekly_salary: 0 },
      undefined
    );
    assert.equal(merged.hourlyRate, 18);
    assert.equal(merged.weeklySalary, 0);
    assert.equal('taxInfo' in merged, false);
  });
});

describe('payrollWeekBoundsFromEndingDate (TZ=UTC)', () => {
  it('maps a Sunday week-ending date to the prior Monday 00:00 through Sunday 23:59:59.999', () => {
    const { weekStart, weekEndDate } = payrollWeekBoundsFromEndingDate('2026-08-09');
    assert.equal(weekStart.toISOString(), '2026-08-03T00:00:00.000Z');
    assert.equal(weekEndDate.toISOString(), '2026-08-09T23:59:59.999Z');
  });

  it('maps a Monday date to that same Monday (daysToSubtract = 0)', () => {
    const { weekStart, weekEndDate } = payrollWeekBoundsFromEndingDate('2026-08-10');
    assert.equal(weekStart.toISOString(), '2026-08-10T00:00:00.000Z');
    assert.equal(weekEndDate.toISOString(), '2026-08-10T23:59:59.999Z');
  });
});

describe('mapPayrollTimeEntry / groupPayrollTimeByUser', () => {
  it('subtracts break minutes and never returns negative hours', () => {
    const mapped = mapPayrollTimeEntry({
      user_id: 1,
      full_name: 'Pat',
      username: 'pat',
      clock_in: '2026-08-03T13:00:00.000Z',
      clock_out: '2026-08-03T21:00:00.000Z',
      break_minutes: 30,
      hourly_rate: 20,
      weekly_salary: 0,
    });
    assert.equal(mapped.hours, 7.5);
    assert.equal(mapped.date, '2026-08-03');
    assert.equal(mapped.break_minutes, 30);
  });

  it('clamps hours at 0 when breaks exceed elapsed time', () => {
    const mapped = mapPayrollTimeEntry({
      user_id: 1,
      full_name: 'Pat',
      username: 'pat',
      clock_in: '2026-08-03T13:00:00.000Z',
      clock_out: '2026-08-03T14:00:00.000Z',
      break_minutes: 90,
      hourly_rate: null,
      weekly_salary: null,
    });
    assert.equal(mapped.hours, 0);
    assert.equal(mapped.hourly_rate, 0);
    assert.equal(mapped.weekly_salary, 0);
  });

  it('sums hours per user across entries', () => {
    const grouped = groupPayrollTimeByUser([
      {
        user_id: 1,
        full_name: 'Pat',
        username: 'pat',
        hourly_rate: 20,
        weekly_salary: 0,
        hours: 7.5,
      },
      {
        user_id: 1,
        full_name: 'Pat',
        username: 'pat',
        hourly_rate: 20,
        weekly_salary: 0,
        hours: 8,
      },
      {
        user_id: 2,
        full_name: 'Sam',
        username: 'sam',
        hourly_rate: 18,
        weekly_salary: 0,
        hours: 4,
      },
    ]);
    assert.equal(grouped[1].total_hours, 15.5);
    assert.equal(grouped[1].entries.length, 2);
    assert.equal(grouped[2].total_hours, 4);
  });
});

describe('payroll history date filter and totals', () => {
  const records = [
    { payDate: '2026-01-15', grossPay: '1000', totalTaxes: '200', netPay: '800' },
    { date: '2026-02-01', grossPay: 500, totalTaxes: 50, netPay: 450 },
    { processedDate: '2026-03-01', grossPay: '250.25', totalTaxes: '10.10', netPay: '240.15' },
  ];

  it('uses payDate, then date, then processedDate for lexicographic bounds', () => {
    const mid = payrollHistoryInDateRange(records, '2026-02-01', '2026-02-28');
    assert.equal(mid.length, 1);
    assert.equal(mid[0].date, '2026-02-01');
  });

  it('returns the original array when no bounds are set', () => {
    assert.equal(payrollHistoryInDateRange(records, undefined, undefined), records);
  });

  it('sums gross/tax/net with parseFloat (NaN on non-numeric gross)', () => {
    const totals = sumPayrollHistoryTotals(records);
    assert.equal(totals.record_count, 3);
    assert.equal(totals.total_gross, 1750.25);
    assert.equal(totals.total_taxes, 260.1);
    assert.equal(totals.total_net, 1490.15);

    const withBad = sumPayrollHistoryTotals([{ grossPay: 'n/a', totalTaxes: '', netPay: null }]);
    assert.equal(Number.isNaN(withBad.total_gross), true);
    assert.equal(withBad.total_taxes, 0);
    assert.equal(withBad.total_net, 0);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPayrollAccessFlag,
  isMasterAdminFlag,
  showClockInHeaderFlag,
  loginWeeklySalary,
  jwtAuthClaims,
  loginUserPayload,
  meUserPayload,
} from '../utils/authSessionFlags.js';

describe('isPayrollAccessFlag', () => {
  it('grants access only for strict numeric 1', () => {
    assert.equal(isPayrollAccessFlag(1), true);
  });

  it('denies truthy lookalikes used in SQLite/JSON payloads', () => {
    assert.equal(isPayrollAccessFlag('1'), false);
    assert.equal(isPayrollAccessFlag(true), false);
    assert.equal(isPayrollAccessFlag(0), false);
    assert.equal(isPayrollAccessFlag('true'), false);
    assert.equal(isPayrollAccessFlag('false'), false);
    assert.equal(isPayrollAccessFlag(null), false);
    assert.equal(isPayrollAccessFlag(undefined), false);
  });
});

describe('isMasterAdminFlag', () => {
  it('grants master-admin only for strict numeric 1', () => {
    assert.equal(isMasterAdminFlag(1), true);
    assert.equal(isMasterAdminFlag('1'), false);
    assert.equal(isMasterAdminFlag(true), false);
    assert.equal(isMasterAdminFlag(0), false);
    assert.equal(isMasterAdminFlag(null), false);
  });
});

describe('showClockInHeaderFlag', () => {
  it('hides the header for 0 and nullish values', () => {
    assert.equal(showClockInHeaderFlag(0), false);
    assert.equal(showClockInHeaderFlag(null), false);
    assert.equal(showClockInHeaderFlag(undefined), false);
  });

  it('shows the header for any other stored value, including string zero', () => {
    assert.equal(showClockInHeaderFlag(1), true);
    assert.equal(showClockInHeaderFlag(true), true);
    assert.equal(showClockInHeaderFlag('0'), true);
    assert.equal(showClockInHeaderFlag('false'), true);
    assert.equal(showClockInHeaderFlag(-1), true);
  });
});

describe('loginWeeklySalary', () => {
  it('coerces only nullish salary to 0 on login, keeping 0 and negatives', () => {
    assert.equal(loginWeeklySalary(null), 0);
    assert.equal(loginWeeklySalary(undefined), 0);
    assert.equal(loginWeeklySalary(0), 0);
    assert.equal(loginWeeklySalary(850), 850);
    assert.equal(loginWeeklySalary(-10), -10);
  });
});

const sampleUser = {
  id: 9,
  username: 'pat',
  email: 'pat@example.com',
  full_name: 'Pat Lee',
  role: 'employee',
  hourly_rate: 22,
  weekly_salary: null,
  show_clock_in_header: 0,
  payroll_access: 1,
  is_master_admin: '1',
  password_hash: 'secret',
};

describe('jwtAuthClaims', () => {
  it('embeds strict payroll/master flags and omits salary/header', () => {
    assert.deepEqual(jwtAuthClaims(sampleUser), {
      id: 9,
      username: 'pat',
      role: 'employee',
      payroll_access: true,
      is_master_admin: false,
    });
  });
});

describe('loginUserPayload', () => {
  it('nulls salary to 0 and maps header/payroll/master flags', () => {
    const payload = loginUserPayload(sampleUser);
    assert.equal(payload.weekly_salary, 0);
    assert.equal(payload.show_clock_in_header, false);
    assert.equal(payload.payroll_access, true);
    assert.equal(payload.is_master_admin, false);
    assert.equal(payload.password_hash, undefined);
  });
});

describe('meUserPayload', () => {
  it('spreads the row so null weekly_salary stays null, unlike login', () => {
    const payload = meUserPayload(sampleUser);
    assert.equal(payload.weekly_salary, null);
    assert.equal(payload.show_clock_in_header, false);
    assert.equal(payload.payroll_access, true);
    assert.equal(payload.is_master_admin, false);
    assert.equal(payload.password_hash, 'secret');
  });
});

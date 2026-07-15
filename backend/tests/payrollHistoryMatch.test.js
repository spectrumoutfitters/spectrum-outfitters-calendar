import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  namesLikelyMatch,
  payrollHistoryRecordMatchesSource,
} from '../utils/payrollHistoryMatch.js';

describe('namesLikelyMatch', () => {
  it('matches normalized and shortened full names', () => {
    assert.equal(namesLikelyMatch('  Patrick Tung Gaines ', 'patrick gaines.'), true);
    assert.equal(namesLikelyMatch('Patrick Gaines', 'Gaines, Patrick'), true);
  });

  it('rejects ambiguous or missing names', () => {
    assert.equal(namesLikelyMatch('Chris Smith', 'Jordan Smith'), false);
    assert.equal(namesLikelyMatch('Chris', 'Chris Smith'), false);
    assert.equal(namesLikelyMatch('', 'Chris Smith'), false);
  });
});

describe('payrollHistoryRecordMatchesSource', () => {
  const userSource = {
    source_type: 'user',
    source_id: 42,
    name: 'Patrick Gaines',
    username: 'pgaines',
    email: 'patrick@example.com',
  };

  it('matches user IDs across supported nested payroll shapes', () => {
    const record = {
      paystub: {
        employee: {
          calendarUserId: '42',
          name: 'Unrelated payroll label',
        },
      },
    };

    assert.equal(payrollHistoryRecordMatchesSource(record, userSource), true);
  });

  it('matches email addresses case-insensitively when IDs are unavailable', () => {
    const record = {
      employee: {
        workEmail: 'Patrick@Example.COM',
      },
    };

    assert.equal(payrollHistoryRecordMatchesSource(record, userSource), true);
  });

  it('matches first/last fields and alternate employee name fields', () => {
    const splitNameRecord = {
      employee: {
        firstName: 'Patrick',
        middleName: 'Tung',
        lastName: 'Gaines',
      },
    };
    const alternateNameRecord = {
      employee: {
        legalName: 'Patrick Gaines',
      },
    };

    assert.equal(payrollHistoryRecordMatchesSource(splitNameRecord, userSource), true);
    assert.equal(payrollHistoryRecordMatchesSource(alternateNameRecord, userSource), true);
  });

  it('matches payroll people by name across paystub export shapes', () => {
    const record = {
      paystub: {
        employeeName: 'Gaines, Patrick',
      },
    };
    const payrollPerson = {
      source_type: 'payroll_person',
      source_id: 7,
      name: 'Patrick Gaines',
    };

    assert.equal(payrollHistoryRecordMatchesSource(record, payrollPerson), true);
  });

  it('rejects unrelated users that only share a last name', () => {
    const record = {
      employee: {
        id: 99,
        name: 'Jordan Smith',
        email: 'jordan@example.com',
      },
    };
    const source = {
      source_type: 'user',
      source_id: 42,
      name: 'Chris Smith',
      email: 'chris@example.com',
    };

    assert.equal(payrollHistoryRecordMatchesSource(record, source), false);
  });
});

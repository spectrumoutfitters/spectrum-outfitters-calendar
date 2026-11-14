import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  namesLikelyMatch,
  payrollHistoryRecordMatchesSource,
} from '../utils/payrollHistoryMatch.js';

const patrick = {
  source_type: 'user',
  source_id: 42,
  name: 'Patrick Gaines',
  username: 'pgaines',
  email: 'patrick@example.com',
};

describe('namesLikelyMatch', () => {
  it('treats case, spacing, periods, and quotes as the same name', () => {
    assert.equal(namesLikelyMatch('  PATRICK   GAINES  ', 'patrick gaines'), true);
    assert.equal(namesLikelyMatch('Patrick Gaines Jr.', 'Patrick Gaines Jr'), true);
    assert.equal(namesLikelyMatch('Patrick "Pat" Gaines', 'Patrick Pat Gaines'), true);
  });

  it('matches Last, First exports, including an apostrophe that becomes a space', () => {
    assert.equal(namesLikelyMatch('Patrick Gaines', 'Gaines, Patrick'), true);
    assert.equal(namesLikelyMatch('Patrick Tung Gaines', 'Gaines, Patrick Tung'), true);
    assert.equal(namesLikelyMatch('Shaq O Neil', "O'Neil, Shaq"), true);
  });

  it('matches when a middle name or a short suffix is only on one side', () => {
    assert.equal(namesLikelyMatch('Patrick Tung Gaines', 'Patrick Gaines'), true);
    assert.equal(namesLikelyMatch('Patrick Gaines', 'Patrick Tung Gaines'), true);
    assert.equal(namesLikelyMatch('Patrick Gaines Jr', 'Gaines, Patrick'), true);
  });

  it('does not match a different person who only shares a first or last name', () => {
    assert.equal(namesLikelyMatch('Patrick Gaines', 'Patrick Nguyen'), false);
    assert.equal(namesLikelyMatch('Patrick Gaines', 'Patricia Gaines'), false);
    assert.equal(namesLikelyMatch('Alicia Keys', 'John Keys'), false);
    assert.equal(namesLikelyMatch('Jane Doe', 'John Smith'), false);
  });

  it('does not match blank names', () => {
    assert.equal(namesLikelyMatch('', 'Patrick Gaines'), false);
    assert.equal(namesLikelyMatch('Patrick Gaines', '   '), false);
    assert.equal(namesLikelyMatch(null, undefined), false);
  });
});

describe('payrollHistoryRecordMatchesSource', () => {
  it('matches a calendar user by id even when the stub name is someone else', () => {
    const cases = [
      ['employee.id', { employee: { id: 42, name: 'Someone Else' } }],
      ['employee.user_id', { employee: { user_id: '42', name: 'Someone Else' } }],
      ['employee.calendarId', { employee: { calendarId: 42, name: 'Someone Else' } }],
      ['employee.linkedUserId', { employee: { linkedUserId: 42, name: 'Someone Else' } }],
      ['employee.spectrum_user_id', { employee: { spectrum_user_id: '42', name: 'Someone Else' } }],
      ['employee_id', { employee_id: 42, employee: { name: 'Someone Else' } }],
      ['calendarUserId', { calendarUserId: '42' }],
      ['selectedEmployee.id', { selectedEmployee: { id: 42, name: 'Someone Else' } }],
      ['paystub.employee.userId', { paystub: { employee: { userId: 42, name: 'Someone Else' } } }],
    ];

    for (const [label, rec] of cases) {
      assert.equal(payrollHistoryRecordMatchesSource(rec, patrick), true, label);
    }
  });

  it('matches a calendar user by email when the stub has no employee id', () => {
    const rec = { employee: { name: 'Someone Else', workEmail: '  Patrick@Example.com ' } };
    assert.equal(payrollHistoryRecordMatchesSource(rec, patrick), true);
  });

  it('does not treat a value without @ as an email', () => {
    const rec = { employee: { name: 'Someone Else', email: 'patrick' } };
    const src = { ...patrick, email: 'patrick' };
    assert.equal(payrollHistoryRecordMatchesSource(rec, src), false);
  });

  it('matches a calendar username when the stub name is that username', () => {
    const rec = { employee: { name: 'pgaines' } };
    assert.equal(payrollHistoryRecordMatchesSource(rec, patrick), true);
  });

  it('reads a display name from the history shapes payroll exports actually use', () => {
    const cases = [
      ['employee.name', { employee: { name: 'Patrick Gaines' } }],
      ['employee.fullName', { employee: { fullName: 'Patrick Gaines' } }],
      ['paystub.employee_name', { paystub: { employee_name: 'Patrick Gaines' } }],
      ['paystubEmployee.full_name', { paystubEmployee: { full_name: 'Patrick Gaines' } }],
      ['selectedEmployee.name', { selectedEmployee: { name: 'Patrick Gaines' } }],
      ['employee_name', { employee_name: 'Patrick Gaines' }],
      ['payee_name', { payee_name: 'Gaines, Patrick' }],
      ['first middle last', { employee: { firstName: 'Patrick', middleName: 'Tung', lastName: 'Gaines' } }],
      ['legalName blob', { employee: { legalName: 'Patrick Gaines' } }],
    ];

    for (const [label, rec] of cases) {
      assert.equal(payrollHistoryRecordMatchesSource(rec, patrick), true, label);
    }
  });

  it('does not match a different calendar user', () => {
    const rec = {
      employee: { id: 7, name: 'Jane Doe', email: 'jane@example.com' },
    };
    assert.equal(payrollHistoryRecordMatchesSource(rec, patrick), false);
  });

  it('does not treat a blank stub or a numeric badge as a name', () => {
    assert.equal(payrollHistoryRecordMatchesSource({}, patrick), false);
    assert.equal(
      payrollHistoryRecordMatchesSource({ employee: null }, patrick),
      false,
    );
    assert.equal(
      payrollHistoryRecordMatchesSource({ employee: { name: '   ' } }, patrick),
      false,
    );
    assert.equal(
      payrollHistoryRecordMatchesSource(
        { employee: { nickname: '123456' } },
        { ...patrick, name: '123456', email: undefined, username: undefined },
      ),
      false,
    );
  });

  it('matches a payroll person by name only', () => {
    const src = { source_type: 'payroll_person', source_id: 99, name: 'Patrick Gaines' };
    assert.equal(
      payrollHistoryRecordMatchesSource(
        { employee: { id: 7, email: 'other@example.com', name: 'Gaines, Patrick' } },
        src,
      ),
      true,
    );
  });

  it('does not attach a payroll person by a colliding id, email, or username', () => {
    const src = {
      source_type: 'payroll_person',
      source_id: 42,
      name: 'Jane Doe',
      username: 'pgaines',
      email: 'patrick@example.com',
    };
    const rec = {
      employee: { id: 42, name: 'Patrick Gaines', email: 'patrick@example.com' },
    };
    assert.equal(payrollHistoryRecordMatchesSource(rec, src), false);
  });
});

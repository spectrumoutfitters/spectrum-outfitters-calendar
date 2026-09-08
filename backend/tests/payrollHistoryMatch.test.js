import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  namesLikelyMatch,
  payrollHistoryRecordMatchesSource,
} from '../utils/payrollHistoryMatch.js';

describe('namesLikelyMatch', () => {
  it('matches exact, lastname-first, and first+last with a dropped middle name', () => {
    assert.equal(namesLikelyMatch('Patrick Gaines', 'Patrick Gaines'), true);
    assert.equal(namesLikelyMatch('Patrick Gaines', 'Gaines, Patrick'), true);
    assert.equal(namesLikelyMatch('Patrick Tung Gaines', 'Patrick Gaines'), true);
    assert.equal(namesLikelyMatch('John Smith', 'Jane Smith'), false);
  });

  it('rejects empty/tiny strings and does not treat initials as significant tokens', () => {
    assert.equal(namesLikelyMatch('', 'Patrick Gaines'), false);
    assert.equal(namesLikelyMatch('Patrick Gaines', null), false);
    assert.equal(namesLikelyMatch('Ed', 'Edward'), false);
    assert.equal(namesLikelyMatch('Al Bo', 'Al Bo Extra'), true);
  });
});

describe('payrollHistoryRecordMatchesSource', () => {
  const user = { source_type: 'user', source_id: 42, name: 'Patrick Gaines', username: 'pgaines', email: 'pat@shop.test' };

  it('matches a calendar user by employee id, email, or display name', () => {
    assert.equal(payrollHistoryRecordMatchesSource({ employeeId: 42 }, user), true);
    assert.equal(payrollHistoryRecordMatchesSource({ employee: { id: '42' } }, user), true);
    assert.equal(
      payrollHistoryRecordMatchesSource({ employee: { email: 'pat@shop.test', name: 'Someone Else' } }, user),
      true
    );
    assert.equal(
      payrollHistoryRecordMatchesSource({ employee: { name: 'Gaines, Patrick' } }, user),
      true
    );
    assert.equal(
      payrollHistoryRecordMatchesSource({ employee: { name: 'Unrelated Person' } }, user),
      false
    );
  });

  it('treats numeric 0 as an id, ignores email without @, and matches username as a name', () => {
    assert.equal(
      payrollHistoryRecordMatchesSource({ employeeId: 0 }, { ...user, source_id: 0 }),
      true
    );
    assert.equal(
      payrollHistoryRecordMatchesSource({ employee: { email: 'not-an-email', name: 'Nope' } }, user),
      false
    );
    assert.equal(
      payrollHistoryRecordMatchesSource({ employee: { name: 'pgaines' } }, user),
      true
    );
  });

  it('matches payroll_person by name only (ids are ignored)', () => {
    const person = { source_type: 'payroll_person', source_id: 99, name: 'Alex Contractor' };
    assert.equal(
      payrollHistoryRecordMatchesSource({ employeeId: 99, employee: { name: 'Unrelated' } }, person),
      false
    );
    assert.equal(
      payrollHistoryRecordMatchesSource({ employee: { name: 'Alex Contractor' } }, person),
      true
    );
  });
});

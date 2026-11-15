import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { payrollHistoryRecordMatchesSource } from '../utils/payrollHistoryMatch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const financePath = path.join(here, '../routes/finance.js');

/**
 * Load the reimbursement link and amount pickers from the route source.
 * finance.js opens SQLite on import, and payroll routes already edit that file.
 */
function loadPayrollHistoryLink() {
  const src = fs.readFileSync(financePath, 'utf8');
  const normLower = sliceFunction(src, 'function normLower(v)');
  const firstLastName = sliceFunction(src, 'function firstLastName(e)');
  const indexEmployees = sliceStatement(src, 'const payrollEmployeeById = new Map();', 'payrollEmployeeById.set(id, e);');
  const payRecordAmount = sliceStatement(src, 'const payRecordAmount = (r) =>', 'return 0;');
  const sourceMatchesRecord = sliceStatement(
    src,
    'const sourceMatchesRecord = (rec, src) =>',
    'payrollHistoryRecordMatchesSource({ employee: { name: linkedName } }, src);'
  );

  if (!sourceMatchesRecord.includes("src.source_type === 'user'")) {
    throw new Error('employee-file link slice missed the calendar-user branch');
  }
  if (!sourceMatchesRecord.includes('linked.calendarId')) {
    throw new Error('employee-file link slice missed calendarId');
  }
  if (!payRecordAmount.includes("'grossPay'")) {
    throw new Error('pay amount slice missed the field order');
  }
  if (payRecordAmount.includes('db.') || sourceMatchesRecord.includes('db.')) {
    throw new Error('slice pulled in database access');
  }

  const factory = new Function(
    'payrollHistoryRecordMatchesSource',
    `${normLower}
    ${firstLastName}
    ${payRecordAmount}
    function indexPayrollEmployees(payrollEmployees) {
      ${indexEmployees}
      return payrollEmployeeById;
    }
    function match(payrollEmployees, rec, src) {
      const payrollEmployeeById = indexPayrollEmployees(payrollEmployees);
      ${sourceMatchesRecord}
      return sourceMatchesRecord(rec, src);
    }
    return { payRecordAmount, firstLastName, normLower, match };`
  );

  return factory(payrollHistoryRecordMatchesSource);
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  return src.slice(start, endOfBrace(src, src.indexOf('{', start)));
}

function sliceStatement(src, signature, mustInclude) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  const sliced = src.slice(start, endOfBrace(src, src.indexOf('{', start)));
  if (!sliced.includes(mustInclude)) {
    throw new Error(`slice of ${signature} did not include ${mustInclude}`);
  }
  return sliced;
}

function endOfBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('unterminated block');
}

const { payRecordAmount, firstLastName, normLower, match } = loadPayrollHistoryLink();

function user(overrides = {}) {
  return {
    source_type: 'user',
    source_id: 42,
    name: 'Patrick Gaines',
    email: 'pat@example.com',
    ...overrides,
  };
}

function history(overrides = {}) {
  return {
    employee: { id: 'emp-9', name: 'Nope Person' },
    ...overrides,
  };
}

describe('payroll history amount used for reimbursement owed', () => {
  it('uses the first positive field and skips zeros, negatives, and non-numbers', () => {
    assert.equal(
      payRecordAmount({
        grossPay: '10.50',
        netPay: 99,
        amount: 80,
      }),
      10.5
    );

    assert.equal(
      payRecordAmount({
        grossPay: 0,
        netPay: '0',
        amount: -5,
        total: 'nope',
        totalPay: '',
        payAmount: null,
        totalAmount: '40',
      }),
      40
    );

    assert.equal(payRecordAmount({}), 0);
    assert.equal(payRecordAmount({ grossPay: '0.00', notes: '500' }), 0);
  });
});

describe('payroll employee file link after the history stub misses', () => {
  it('links a calendar user by the payroll file calendar id', () => {
    const linked = match(
      [{ id: 'emp-9', calendarId: 42, email: 'other@example.com', name: 'Alicia Keys' }],
      history(),
      user()
    );
    assert.equal(linked, true);
  });

  it('links a calendar user by payroll-file email when the calendar id is someone else', () => {
    const linked = match(
      [{ id: 'emp-9', calendarId: '999', email: '  Pat@Example.com ', name: 'Alicia Keys' }],
      { employeeId: 'emp-9', employee: { name: 'Nope Person' } },
      user()
    );
    assert.equal(linked, true);
    assert.equal(normLower('  Pat@Example.com '), 'pat@example.com');
    assert.equal(normLower(null), '');
  });

  it('links a calendar user by the payroll file name when id and email miss', () => {
    const byDisplayName = match(
      [{
        id: 'emp-9',
        calendarId: '',
        email: 'other@example.com',
        name: 'Patrick Gaines',
        firstName: 'Alicia',
        lastName: 'Keys',
      }],
      history(),
      user({ email: 'pat@example.com' })
    );
    assert.equal(byDisplayName, true);

    const byParts = match(
      [{
        id: 'emp-9',
        name: '',
        firstName: ' Patrick ',
        middleName: ' ',
        lastName: 'Gaines',
      }],
      { employee_id: 'emp-9', payee_name: 'Nope Person' },
      user({ email: undefined })
    );
    assert.equal(byParts, true);
    assert.equal(
      firstLastName({ firstName: ' Patrick ', middleName: ' ', lastName: 'Gaines' }),
      'Patrick Gaines'
    );
    assert.equal(
      firstLastName({ firstName: 'Patrick', middleName: 'Tung', lastName: 'Gaines' }),
      'Patrick Tung Gaines'
    );
    assert.equal(firstLastName(null), '');
  });

  it('does not link a history row with no payroll id, or an id missing from the file', () => {
    const employees = [{ id: 'emp-9', calendarId: '42', name: 'Patrick Gaines', email: 'pat@example.com' }];
    assert.equal(match(employees, { employee: { name: 'Nope Person' } }, user()), false);
    assert.equal(match(employees, history({ employee: { id: 'missing', name: 'Nope Person' } }), user()), false);
  });

  it('links a payroll person only by the file name', () => {
    const employees = [{
      id: 42,
      calendarId: '7',
      email: 'pat@example.com',
      name: 'Patrick Gaines',
    }];
    const src = {
      source_type: 'payroll_person',
      source_id: 7,
      name: 'Patrick Gaines',
      email: 'pat@example.com',
    };
    assert.equal(match(employees, { employee: { id: '42', name: 'Nope Person' } }, src), true);

    const differentPerson = {
      ...src,
      name: 'Alicia Keys',
    };
    assert.equal(
      match(employees, { employee: { id: '42', name: 'Nope Person' } }, differentPerson),
      false
    );
  });
});

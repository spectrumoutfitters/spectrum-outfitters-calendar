import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHours,
  effectiveBreakMinutes,
  hoursWorkedFromEntry,
  isLunchBreakNotes,
  sqlEffectiveBreakHoursExpr,
} from '../utils/helpers.js';

describe('effectiveBreakMinutes / lunch clock-out', () => {
  it('treats official Go-to-Lunch marker as zero deduction', () => {
    assert.equal(isLunchBreakNotes('Lunch break'), true);
    assert.equal(effectiveBreakMinutes('Lunch break', 60), 0);
    assert.equal(effectiveBreakMinutes('Went to lunch break early', 60), 0);
  });

  it('keeps real unpaid breaks', () => {
    assert.equal(effectiveBreakMinutes(null, 15), 15);
    assert.equal(effectiveBreakMinutes('smoking', 30), 30);
  });

  it('does not let negative break_minutes inflate hours', () => {
    assert.equal(effectiveBreakMinutes(null, -480), 0);
    assert.equal(calculateHours('2026-09-21T13:00:00.000Z', '2026-09-21T21:00:00.000Z', -60), 8);
  });
});

describe('hoursWorkedFromEntry (payroll / timesheet pay)', () => {
  it('does not subtract the 60-minute lunch marker from a morning segment', () => {
    // 8:00–12:00 (4h) clock-out via Go to Lunch stores break_minutes=60
    const morning = {
      clock_in: '2026-09-21T13:00:00.000Z',
      clock_out: '2026-09-21T17:00:00.000Z',
      break_minutes: 60,
      notes: 'Lunch break',
    };
    const afternoon = {
      clock_in: '2026-09-21T18:00:00.000Z',
      clock_out: '2026-09-21T22:00:00.000Z',
      break_minutes: 0,
      notes: null,
    };
    const morningHours = hoursWorkedFromEntry(morning);
    const afternoonHours = hoursWorkedFromEntry(afternoon);
    assert.equal(morningHours, 4);
    assert.equal(afternoonHours, 4);
    assert.equal(morningHours + afternoonHours, 8);
    // Naive subtraction of stored break_minutes would pay 7 hours
    const naiveMorning =
      (new Date(morning.clock_out) - new Date(morning.clock_in)) / 3600000 - morning.break_minutes / 60;
    assert.equal(naiveMorning, 3);
  });

  it('still subtracts a real unpaid break on a non-lunch punch', () => {
    const entry = {
      clock_in: '2026-09-21T13:00:00.000Z',
      clock_out: '2026-09-21T21:00:00.000Z',
      break_minutes: 30,
      notes: null,
    };
    assert.equal(hoursWorkedFromEntry(entry), 7.5);
  });
});

describe('sqlEffectiveBreakHoursExpr', () => {
  it('skips lunch notes and clamps negatives', () => {
    const sql = sqlEffectiveBreakHoursExpr('te');
    assert.match(sql, /te\.notes/i);
    assert.match(sql, /%lunch break%/);
    assert.match(sql, /te\.break_minutes/);
  });

  it('evaluates to 8 hours for a lunch-split day in SQLite', async () => {
    const sqlite3 = (await import('sqlite3')).default;
    const db = new sqlite3.Database(':memory:');
    const total = await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('CREATE TABLE time_entries (clock_in TEXT, clock_out TEXT, break_minutes REAL, notes TEXT)');
        db.run(
          'INSERT INTO time_entries VALUES (?,?,?,?)',
          ['2026-09-21T13:00:00.000Z', '2026-09-21T17:00:00.000Z', 60, 'Lunch break']
        );
        db.run(
          'INSERT INTO time_entries VALUES (?,?,?,?)',
          ['2026-09-21T18:00:00.000Z', '2026-09-21T22:00:00.000Z', 0, null]
        );
        db.get(
          `SELECT SUM((julianday(clock_out) - julianday(clock_in)) * 24 - (${sqlEffectiveBreakHoursExpr()})) AS total FROM time_entries`,
          (err, row) => (err ? reject(err) : resolve(row.total))
        );
      });
    });
    db.close();
    assert.ok(Math.abs(Number(total) - 8) < 0.001, `expected 8, got ${total}`);
  });
});

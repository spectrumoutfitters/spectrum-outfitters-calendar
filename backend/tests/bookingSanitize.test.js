import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_SERVICES_CHECKLIST_DEFAULT,
  BOOKING_WEEKLY_HOURS_DEFAULT,
  emailListFromJson,
  parseJsonSafe,
  sanitizeServiceChecklist,
  sanitizeVehicleList,
  sanitizeWeeklyHoursJson,
  uniqStrings,
} from '../utils/bookingSanitize.js';

describe('parseJsonSafe', () => {
  it('returns fallback for empty, null, or invalid JSON', () => {
    assert.deepEqual(parseJsonSafe(null, []), []);
    assert.deepEqual(parseJsonSafe('', { a: 1 }), { a: 1 });
    assert.deepEqual(parseJsonSafe('{not-json', { ok: true }), { ok: true });
  });

  it('parses valid JSON strings', () => {
    assert.deepEqual(parseJsonSafe('{"x":2}', null), { x: 2 });
  });
});

describe('uniqStrings', () => {
  it('trims, drops blanks, and dedupes while preserving order', () => {
    assert.deepEqual(uniqStrings([' a ', 'a', '', 'b', 'a']), ['a', 'b']);
  });
});

describe('sanitizeWeeklyHoursJson', () => {
  it('falls back to Mon–Fri defaults for corrupt input', () => {
    assert.equal(sanitizeWeeklyHoursJson('not-json'), BOOKING_WEEKLY_HOURS_DEFAULT);
    assert.equal(sanitizeWeeklyHoursJson(null), BOOKING_WEEKLY_HOURS_DEFAULT);
  });

  it('keeps only HH:MM intervals on weekday keys 1–7', () => {
    const raw = JSON.stringify({
      '1': [{ start: '08:00', end: '17:00' }, { start: 'bad', end: '17:00' }],
      '2': 'not-an-array',
      '9': [{ start: '09:00', end: '10:00' }],
      '6': [{ start: '10:00', end: '14:00' }],
    });
    const out = JSON.parse(sanitizeWeeklyHoursJson(raw));
    assert.deepEqual(out['1'], [{ start: '08:00', end: '17:00' }]);
    assert.deepEqual(out['2'], []);
    assert.deepEqual(out['6'], [{ start: '10:00', end: '14:00' }]);
    assert.equal(out['9'], undefined);
    assert.deepEqual(out['7'], []);
  });
});

describe('sanitizeServiceChecklist', () => {
  it('returns default checklist when input is not an array', () => {
    assert.deepEqual(
      sanitizeServiceChecklist(null),
      JSON.parse(BOOKING_SERVICES_CHECKLIST_DEFAULT)
    );
  });

  it('drops blank labels, clamps fields, and synthesizes missing ids', () => {
    const out = sanitizeServiceChecklist([
      { id: 'oil change', label: '  Oil  ' },
      { label: 'Brakes' },
      { id: 'x', label: '' },
      { id: 'y', label: 12 },
      {
        id: 'z'.repeat(80),
        label: 'L'.repeat(200),
      },
    ]);
    assert.deepEqual(out[0], { id: 'oil_change', label: 'Oil' });
    assert.deepEqual(out[1], { id: 'svc_1', label: 'Brakes' });
    assert.equal(out.length, 3);
    assert.equal(out[2].id.length, 64);
    assert.equal(out[2].label.length, 120);
  });
});

describe('emailListFromJson', () => {
  it('keeps valid unique emails and drops junk', () => {
    assert.deepEqual(
      emailListFromJson(JSON.stringify(['Neel@Example.COM', 'neel@example.com', 'nope', 'a@b.c'])),
      ['neel@example.com', 'a@b.c']
    );
  });

  it('returns [] for non-array JSON', () => {
    assert.deepEqual(emailListFromJson('{"email":"x@y.z"}'), []);
  });
});

describe('sanitizeVehicleList', () => {
  it('returns [] for non-arrays', () => {
    assert.deepEqual(sanitizeVehicleList(null), []);
    assert.deepEqual(sanitizeVehicleList({ year: '2020' }), []);
  });

  it('drops empty vehicles, uppercases vin/plate, and caps at 10', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      year: String(2010 + i),
      make: 'Ford',
      model: 'F150',
      vin: 'abc',
      license_plate: 'tx1',
    }));
    many.unshift({ year: '', make: '', model: '' });
    const out = sanitizeVehicleList(many);
    assert.equal(out.length, 10);
    assert.equal(out[0].year, '2010');
    assert.equal(out[0].vin, 'ABC');
    assert.equal(out[0].plate, 'TX1');
  });
});

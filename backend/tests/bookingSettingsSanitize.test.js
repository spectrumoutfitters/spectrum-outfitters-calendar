import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BOOKING_WEEKLY_HOURS_JSON,
  DEFAULT_BOOKING_SERVICES_CHECKLIST,
  parseJsonSafe,
  uniqCalendarIds,
  calendarIdsFromGoogleCfg,
  sanitizeWeeklyHoursJson,
  sanitizeServiceChecklist,
  emailListFromJson,
  sanitizeVehicleList
} from '../utils/bookingSettingsSanitize.js';

describe('uniqCalendarIds', () => {
  it('trims strings, drops empties/non-strings, and de-dupes first-seen', () => {
    assert.deepEqual(uniqCalendarIds(['  primary  ', 'primary', '', 12, 'team@x.com']), [
      'primary',
      'team@x.com'
    ]);
    assert.deepEqual(uniqCalendarIds(null), []);
  });
});

describe('calendarIdsFromGoogleCfg', () => {
  it('uses sync_calendar_ids JSON when every item is a non-empty string', () => {
    assert.deepEqual(
      calendarIdsFromGoogleCfg({
        sync_calendar_ids: JSON.stringify([' A ', 'A', 'b@c.com']),
        calendar_id: 'ignored'
      }),
      ['A', 'b@c.com']
    );
  });

  it('falls back to calendar_id or primary when JSON is missing, mixed, or invalid', () => {
    assert.deepEqual(calendarIdsFromGoogleCfg({ calendar_id: 'shop' }), ['shop']);
    assert.deepEqual(calendarIdsFromGoogleCfg({}), ['primary']);
    assert.deepEqual(
      calendarIdsFromGoogleCfg({ sync_calendar_ids: 'not-json', calendar_id: 'shop' }),
      ['shop']
    );
    assert.deepEqual(
      calendarIdsFromGoogleCfg({ sync_calendar_ids: JSON.stringify(['ok', 1]), calendar_id: 'shop' }),
      ['shop']
    );
  });
});

describe('sanitizeWeeklyHoursJson', () => {
  it('keeps HH:MM blocks for days 1-7 and drops invalid / extra keys', () => {
    const raw = JSON.stringify({
      1: [{ start: '08:00', end: '17:00' }, { start: 'bad', end: '17:00' }],
      6: [{ start: '09:00:00', end: '13:00' }],
      8: [{ start: '00:00', end: '23:59' }],
      extra: true
    });
    const parsed = JSON.parse(sanitizeWeeklyHoursJson(raw));
    assert.deepEqual(parsed['1'], [{ start: '08:00', end: '17:00' }]);
    assert.deepEqual(parsed['6'], [{ start: '09:00', end: '13:00' }]);
    assert.deepEqual(parsed['7'], []);
    assert.equal('8' in parsed, false);
  });

  it('returns the default JSON when parse fails or value is not an object; [] is an object so it yields empty days', () => {
    assert.equal(sanitizeWeeklyHoursJson('nope'), DEFAULT_BOOKING_WEEKLY_HOURS_JSON);
    assert.equal(sanitizeWeeklyHoursJson(''), DEFAULT_BOOKING_WEEKLY_HOURS_JSON);
    const emptyDays = JSON.parse(sanitizeWeeklyHoursJson('[]'));
    assert.deepEqual(emptyDays['1'], []);
    assert.deepEqual(emptyDays['5'], []);
  });
});

describe('sanitizeServiceChecklist', () => {
  it('drops blank labels, trims, maps whitespace ids to _, and defaults missing ids', () => {
    assert.deepEqual(
      sanitizeServiceChecklist([
        { id: 'oil change', label: '  Oil  ' },
        { label: 'Brakes' },
        { id: 'x', label: '   ' },
        { id: 'y', label: 12 }
      ]),
      [
        { id: 'oil_change', label: 'Oil' },
        { id: 'svc_1', label: 'Brakes' }
      ]
    );
  });

  it('returns the shipped default list when input is not an array', () => {
    assert.deepEqual(sanitizeServiceChecklist(null), DEFAULT_BOOKING_SERVICES_CHECKLIST);
    assert.deepEqual(sanitizeServiceChecklist({}), DEFAULT_BOOKING_SERVICES_CHECKLIST);
  });
});

describe('emailListFromJson', () => {
  it('lowercases, validates local@domain.tld, and de-dupes', () => {
    assert.deepEqual(
      emailListFromJson(JSON.stringify(['  A@Shop.COM ', 'a@shop.com', 'not-an-email', '', 'b@x.io'])),
      ['a@shop.com', 'b@x.io']
    );
    assert.deepEqual(emailListFromJson('not-json'), []);
    assert.deepEqual(emailListFromJson(JSON.stringify({ a: 1 })), []);
  });
});

describe('sanitizeVehicleList', () => {
  it('caps at 10, uppercases VIN/plate, skips empty year/make/model, accepts license_plate', () => {
    const one = sanitizeVehicleList([
      { year: ' 2020 ', make: 'Ford', model: 'F-150', vin: '1ftabc', license_plate: 'abc123' },
      { vin: 'ONLYVIN' },
      { year: '2018', make: '', model: '' }
    ]);
    assert.deepEqual(one, [
      { year: '2020', make: 'Ford', model: 'F-150', vin: '1FTABC', plate: 'ABC123' },
      { year: '2018' }
    ]);
    assert.equal(sanitizeVehicleList(null).length, 0);
    const many = sanitizeVehicleList(Array.from({ length: 12 }, (_, i) => ({ year: String(2010 + i) })));
    assert.equal(many.length, 10);
  });
});

describe('parseJsonSafe', () => {
  it('returns fallback for empty, null, or invalid JSON', () => {
    assert.deepEqual(parseJsonSafe('', { a: 1 }), { a: 1 });
    assert.deepEqual(parseJsonSafe(null, []), []);
    assert.deepEqual(parseJsonSafe('nope', 0), 0);
    assert.deepEqual(parseJsonSafe('[1]', null), [1]);
  });
});

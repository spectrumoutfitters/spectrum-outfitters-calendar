import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  weeklyFromForms,
  hydrateWeekly,
  uniqCalendarIdsArray,
} from '../src/utils/bookingWeeklyHours.js';

describe('weeklyFromForms', () => {
  it('maps Mon–Fri to the same weekday window and leaves weekends empty when off', () => {
    const weekly = weeklyFromForms({
      monOpen: '08:00',
      monClose: '17:00',
      satOn: false,
      sunOn: false,
      satOpen: '09:00',
      satClose: '13:00',
      sunOpen: '10:00',
      sunClose: '14:00',
    });
    const weekdays = [{ start: '08:00', end: '17:00' }];
    assert.deepEqual(weekly['1'], weekdays);
    assert.deepEqual(weekly['5'], weekdays);
    assert.equal(weekly['1'], weekly['3']); // shared array reference (current save behavior)
    assert.deepEqual(weekly['6'], []);
    assert.deepEqual(weekly['7'], []);
  });

  it('includes Saturday/Sunday windows when toggled on', () => {
    const weekly = weeklyFromForms({
      monOpen: '07:30',
      monClose: '16:30',
      satOn: true,
      sunOn: true,
      satOpen: '09:00',
      satClose: '13:00',
      sunOpen: '10:00',
      sunClose: '14:00',
    });
    assert.deepEqual(weekly['6'], [{ start: '09:00', end: '13:00' }]);
    assert.deepEqual(weekly['7'], [{ start: '10:00', end: '14:00' }]);
    assert.deepEqual(weekly['2'], [{ start: '07:30', end: '16:30' }]);
  });
});

describe('hydrateWeekly', () => {
  it('defaults to Mon–Fri 08:00–17:00 with weekend toggles off', () => {
    assert.deepEqual(hydrateWeekly(null), {
      monOpen: '08:00',
      monClose: '17:00',
      satOn: false,
      satOpen: '09:00',
      satClose: '13:00',
      sunOn: false,
      sunOpen: '09:00',
      sunClose: '13:00',
    });
    assert.deepEqual(hydrateWeekly({}), hydrateWeekly(null));
  });

  it('reads weekday hours from key 1 and weekend toggles from non-empty day arrays', () => {
    const form = hydrateWeekly({
      '1': [{ start: '07:00', end: '16:00' }],
      '6': [{ start: '08:30', end: '12:30' }],
      '7': [],
    });
    assert.equal(form.monOpen, '07:00');
    assert.equal(form.monClose, '16:00');
    assert.equal(form.satOn, true);
    assert.equal(form.satOpen, '08:30');
    assert.equal(form.satClose, '12:30');
    assert.equal(form.sunOn, false);
    assert.equal(form.sunOpen, '09:00');
    assert.equal(form.sunClose, '13:00');
  });

  it('round-trips through weeklyFromForms for weekday + Saturday config', () => {
    const form = {
      monOpen: '08:00',
      monClose: '17:00',
      satOn: true,
      satOpen: '09:00',
      satClose: '13:00',
      sunOn: false,
      sunOpen: '09:00',
      sunClose: '13:00',
    };
    assert.deepEqual(hydrateWeekly(weeklyFromForms(form)), form);
  });
});

describe('uniqCalendarIdsArray', () => {
  it('trims, drops empties, and preserves first-seen order', () => {
    assert.deepEqual(
      uniqCalendarIdsArray([' a ', 'b', 'a', '', null, 'b', ' c ']),
      ['a', 'b', 'c']
    );
  });
});

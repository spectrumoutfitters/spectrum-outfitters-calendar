import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calendarIdForGoogleEvent } from '../utils/googleCalendarEventId.js';

describe('calendarIdForGoogleEvent', () => {
  it('uses push_calendar_id when admin targeted a non-default calendar', () => {
    const id = calendarIdForGoogleEvent(
      { push_calendar_id: 'outfitters-events@group.calendar.google.com', source_calendar_id: null },
      { calendar_id: 'primary' }
    );
    assert.equal(id, 'outfitters-events@group.calendar.google.com');
  });

  it('uses source_calendar_id for pulled secondary-calendar events (holidays / events)', () => {
    const id = calendarIdForGoogleEvent(
      { push_calendar_id: null, source_calendar_id: 'en.usa#holiday@group.v.calendar.google.com' },
      { calendar_id: 'primary' }
    );
    assert.equal(id, 'en.usa#holiday@group.v.calendar.google.com');
  });

  it('prefers push_calendar_id over source when both are set', () => {
    const id = calendarIdForGoogleEvent(
      {
        push_calendar_id: 'projects@group.calendar.google.com',
        source_calendar_id: 'events@group.calendar.google.com'
      },
      { calendar_id: 'primary' }
    );
    assert.equal(id, 'projects@group.calendar.google.com');
  });

  it('falls back to cfg.calendar_id when the entry has no calendar ids (legacy default-calendar rows)', () => {
    const id = calendarIdForGoogleEvent(
      { push_calendar_id: null, source_calendar_id: null, google_event_id: 'abc' },
      { calendar_id: 'primary' }
    );
    assert.equal(id, 'primary');
  });

  it('falls back to primary when cfg.calendar_id is also empty', () => {
    assert.equal(calendarIdForGoogleEvent({}, {}), 'primary');
    assert.equal(calendarIdForGoogleEvent(null, null), 'primary');
  });

  it('treats whitespace-only entry ids as missing so delete still targets cfg.calendar_id', () => {
    const id = calendarIdForGoogleEvent(
      { push_calendar_id: '  ', source_calendar_id: '' },
      { calendar_id: 'shop-primary@group.calendar.google.com' }
    );
    assert.equal(id, 'shop-primary@group.calendar.google.com');
  });

  it('does not use cfg.calendar_id when it would miss a pulled event (the resurrection bug)', () => {
    const cfg = { calendar_id: 'primary' };
    const pulledHoliday = {
      google_event_id: 'holiday-evt-1',
      source_calendar_id: 'en.usa#holiday@group.v.calendar.google.com',
      push_calendar_id: null
    };
    const deleteTarget = calendarIdForGoogleEvent(pulledHoliday, cfg);
    assert.notEqual(deleteTarget, cfg.calendar_id);
    assert.equal(deleteTarget, pulledHoliday.source_calendar_id);
  });
});

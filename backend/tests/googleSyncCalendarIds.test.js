import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../utils/googleCalendarService.js'
);

/**
 * Load the calendar-id list used when pulling Google events into the shop schedule.
 * googleCalendarService.js opens SQLite and Google clients on import.
 */
function loadGetSyncCalendarIds() {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const signature = 'function getSyncCalendarIds(cfg)';
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  const body = src.slice(start, endOfBrace(src, src.indexOf('{', start)));

  if (!body.includes('JSON.parse(raw)')) {
    throw new Error('slice missed JSON parsing of sync_calendar_ids');
  }
  if (!body.includes("parsed.every((id) => typeof id === 'string')")) {
    throw new Error('slice missed the all-strings guard');
  }
  if (!body.includes("cfg.calendar_id || 'primary'")) {
    throw new Error('slice missed the primary fallback');
  }
  if (body.includes('await ') || body.includes('calendar.events') || body.includes('db.')) {
    throw new Error('slice pulled in the Google pull loop');
  }

  return new Function(`${body}\nreturn getSyncCalendarIds;`)();
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
  throw new Error('unterminated getSyncCalendarIds');
}

const getSyncCalendarIds = loadGetSyncCalendarIds();

const shopCalendar = 'shop@group.calendar.google.com';
const eventsCalendar = 'events@group.calendar.google.com';

describe('Google sync calendar id list', () => {
  it('pulls every listed calendar, in stored order, instead of the single default', () => {
    assert.deepEqual(
      getSyncCalendarIds({
        sync_calendar_ids: JSON.stringify([shopCalendar, eventsCalendar]),
        calendar_id: 'primary'
      }),
      [shopCalendar, eventsCalendar]
    );
  });

  it('falls back to calendar_id when the sync list is missing, empty, or not all strings', () => {
    const fallback = { calendar_id: shopCalendar };
    const rejectedLists = [
      undefined,
      '',
      '   ',
      '[]',
      'not-json',
      '{"id":"events"}',
      JSON.stringify([shopCalendar, 12]),
      JSON.stringify([null])
    ];

    for (const sync_calendar_ids of rejectedLists) {
      assert.deepEqual(
        getSyncCalendarIds({ ...fallback, sync_calendar_ids }),
        [shopCalendar]
      );
    }
  });

  it('uses primary when neither a sync list nor calendar_id is set', () => {
    assert.deepEqual(getSyncCalendarIds({}), ['primary']);
    assert.deepEqual(
      getSyncCalendarIds({ sync_calendar_ids: '[]', calendar_id: '' }),
      ['primary']
    );
  });
});

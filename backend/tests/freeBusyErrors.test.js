import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectFreeBusyErrors } from '../utils/googleCalendarService.js';

describe('collectFreeBusyErrors', () => {
  it('treats missing calendar entries as incomplete', () => {
    const errors = collectFreeBusyErrors(['shop@example.com', 'primary'], {
      primary: { busy: [] }
    });
    assert.deepEqual(errors, [{ calendarId: 'shop@example.com', reason: 'missing' }]);
  });

  it('collects per-calendar FreeBusy API errors', () => {
    const errors = collectFreeBusyErrors(['a@ex.com'], {
      'a@ex.com': {
        busy: [],
        errors: [{ domain: 'global', reason: 'notFound' }]
      }
    });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].calendarId, 'a@ex.com');
    assert.equal(errors[0].reason, 'notFound');
  });

  it('returns no errors when every requested calendar is present without errors', () => {
    const errors = collectFreeBusyErrors(['primary'], {
      primary: { busy: [{ start: '2026-07-06T13:00:00Z', end: '2026-07-06T13:30:00Z' }] }
    });
    assert.deepEqual(errors, []);
  });
});

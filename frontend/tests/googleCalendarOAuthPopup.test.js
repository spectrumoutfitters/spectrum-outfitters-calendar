import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  googleCalendarOAuthPopupOrigins,
  isGoogleCalendarOAuthPopupMessage,
  googleCalendarIdSaveError,
} from '../src/utils/googleCalendarOAuthPopup.js';

describe('googleCalendarOAuthPopupOrigins', () => {
  it('allows the page origin plus :5000 hosts for this hostname and localhost/127.0.0.1', () => {
    const origins = googleCalendarOAuthPopupOrigins({
      pageOrigin: 'https://shop.example:5173',
      hostname: 'shop.example',
    });
    assert.equal(origins.has('https://shop.example:5173'), true);
    assert.equal(origins.has('http://shop.example:5000'), true);
    assert.equal(origins.has('https://shop.example:5000'), true);
    assert.equal(origins.has('http://localhost:5000'), true);
    assert.equal(origins.has('https://localhost:5000'), true);
    assert.equal(origins.has('http://127.0.0.1:5000'), true);
    assert.equal(origins.has('https://127.0.0.1:5000'), true);
    assert.equal(origins.has('https://evil.example'), false);
  });

  it('falls back hostname to localhost when missing', () => {
    const origins = googleCalendarOAuthPopupOrigins({ pageOrigin: 'http://localhost:5173' });
    assert.equal(origins.has('http://localhost:5000'), true);
    assert.equal(origins.has('https://localhost:5000'), true);
  });
});

describe('isGoogleCalendarOAuthPopupMessage', () => {
  const origins = googleCalendarOAuthPopupOrigins({
    pageOrigin: 'https://app.local',
    hostname: 'app.local',
  });

  it('accepts the connected event from an allowed origin', () => {
    assert.equal(
      isGoogleCalendarOAuthPopupMessage(
        { origin: 'https://app.local', data: { type: 'spectrum_google_calendar_connected' } },
        origins
      ),
      true
    );
    assert.equal(
      isGoogleCalendarOAuthPopupMessage(
        { origin: 'https://app.local:5000', data: { type: 'spectrum_google_calendar_connected' } },
        origins
      ),
      true
    );
  });

  it('rejects the wrong type or a disallowed origin', () => {
    assert.equal(
      isGoogleCalendarOAuthPopupMessage(
        { origin: 'https://evil.example', data: { type: 'spectrum_google_calendar_connected' } },
        origins
      ),
      false
    );
    assert.equal(
      isGoogleCalendarOAuthPopupMessage(
        { origin: 'https://app.local', data: { type: 'other' } },
        origins
      ),
      false
    );
    assert.equal(isGoogleCalendarOAuthPopupMessage({ origin: 'https://app.local' }, origins), false);
    assert.equal(isGoogleCalendarOAuthPopupMessage(null, origins), false);
  });
});

describe('googleCalendarIdSaveError', () => {
  it('rejects empty / whitespace calendar ids', () => {
    assert.equal(googleCalendarIdSaveError(''), 'Calendar ID cannot be empty.');
    assert.equal(googleCalendarIdSaveError('   '), 'Calendar ID cannot be empty.');
    assert.equal(googleCalendarIdSaveError(null), 'Calendar ID cannot be empty.');
    assert.equal(googleCalendarIdSaveError('primary'), null);
    assert.equal(googleCalendarIdSaveError('  cal@group.calendar.google.com  '), null);
  });
});

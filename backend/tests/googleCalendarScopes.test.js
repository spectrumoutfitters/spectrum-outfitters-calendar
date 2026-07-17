import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CALENDAR_SCOPE,
  GMAIL_SEND_SCOPE,
  USERINFO_EMAIL_SCOPE,
  hasBookingOutboundMailScopes,
  hasGmailSendScope,
  hasSenderIdentityScope
} from '../utils/googleCalendarService.js';

describe('Google booking mail OAuth scopes', () => {
  it('accepts the full booking consent scope set', () => {
    const scopes = [CALENDAR_SCOPE, GMAIL_SEND_SCOPE, USERINFO_EMAIL_SCOPE].join(' ');

    assert.equal(hasGmailSendScope(scopes), true);
    assert.equal(hasSenderIdentityScope(scopes), true);
    assert.equal(hasBookingOutboundMailScopes(scopes), true);
  });

  it('requires both Gmail send and sender identity permissions', () => {
    assert.equal(hasBookingOutboundMailScopes(GMAIL_SEND_SCOPE), false);
    assert.equal(hasBookingOutboundMailScopes(USERINFO_EMAIL_SCOPE), false);
    assert.equal(hasBookingOutboundMailScopes(CALENDAR_SCOPE), false);
  });

  it('recognizes short and case-insensitive scope forms', () => {
    const scopes = 'GMAIL.SEND USERINFO.EMAIL';

    assert.equal(hasGmailSendScope(scopes), true);
    assert.equal(hasSenderIdentityScope(scopes), true);
    assert.equal(hasBookingOutboundMailScopes(scopes), true);
  });

  it('accepts Gmail profile-read permission as sender identity access', () => {
    const scopes = `${GMAIL_SEND_SCOPE} https://www.googleapis.com/auth/gmail.readonly`;

    assert.equal(hasBookingOutboundMailScopes(scopes), true);
  });

  it('rejects missing or empty scope values', () => {
    for (const scopes of [undefined, null, '']) {
      assert.equal(hasGmailSendScope(scopes), false);
      assert.equal(hasSenderIdentityScope(scopes), false);
      assert.equal(hasBookingOutboundMailScopes(scopes), false);
    }
  });
});

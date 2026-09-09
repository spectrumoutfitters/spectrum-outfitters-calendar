import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasGmailSendScope,
  hasSenderIdentityScope,
  hasBookingOutboundMailScopes,
  shouldSyncEntryToGoogle,
} from '../utils/googleCalendarScopes.js';

describe('hasGmailSendScope', () => {
  it('matches gmail.send substring variants and rejects empty / unrelated', () => {
    assert.equal(hasGmailSendScope('https://www.googleapis.com/auth/gmail.send'), true);
    assert.equal(hasGmailSendScope('auth/gmail.send calendar.readonly'), true);
    assert.equal(hasGmailSendScope('GMAIL.SEND'), true);
    assert.equal(hasGmailSendScope(''), false);
    assert.equal(hasGmailSendScope(null), false);
    assert.equal(hasGmailSendScope('https://www.googleapis.com/auth/calendar'), false);
  });
});

describe('hasSenderIdentityScope', () => {
  it('accepts userinfo.email, Gmail profile scopes, and full-mail; rejects send-only', () => {
    assert.equal(hasSenderIdentityScope('https://www.googleapis.com/auth/userinfo.email'), true);
    assert.equal(hasSenderIdentityScope('/auth/userinfo.email'), true);
    assert.equal(hasSenderIdentityScope('gmail.readonly'), true);
    assert.equal(hasSenderIdentityScope('gmail.metadata'), true);
    assert.equal(hasSenderIdentityScope('gmail.modify'), true);
    assert.equal(hasSenderIdentityScope('gmail.compose'), true);
    assert.equal(hasSenderIdentityScope('https://mail.google.com/'), true);
    assert.equal(hasSenderIdentityScope('https://www.googleapis.com/auth/gmail.send'), false);
    assert.equal(hasSenderIdentityScope(''), false);
    assert.equal(hasSenderIdentityScope(undefined), false);
  });
});

describe('hasBookingOutboundMailScopes', () => {
  it('requires both send and sender-identity; send-only or identity-only fail', () => {
    assert.equal(
      hasBookingOutboundMailScopes(
        'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email'
      ),
      true
    );
    assert.equal(hasBookingOutboundMailScopes('gmail.send gmail.readonly'), true);
    assert.equal(hasBookingOutboundMailScopes('https://www.googleapis.com/auth/gmail.send'), false);
    assert.equal(hasBookingOutboundMailScopes('userinfo.email'), false);
  });
});

describe('shouldSyncEntryToGoogle', () => {
  it('skips missing, pending, and time_off_request; syncs approved / other types', () => {
    assert.equal(shouldSyncEntryToGoogle(null), false);
    assert.equal(shouldSyncEntryToGoogle(undefined), false);
    assert.equal(shouldSyncEntryToGoogle({ status: 'pending', type: 'day_off' }), false);
    assert.equal(shouldSyncEntryToGoogle({ status: 'approved', type: 'time_off_request' }), false);
    assert.equal(shouldSyncEntryToGoogle({ status: 'approved', type: 'day_off' }), true);
    assert.equal(shouldSyncEntryToGoogle({ status: 'approved', type: 'vacation' }), true);
    assert.equal(shouldSyncEntryToGoogle({ type: 'meeting' }), true);
  });
});

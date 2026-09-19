import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatUnreadBadgeCount, shouldAutoShowUpdates } from '../src/utils/updatesBadgeGate.js';

describe('formatUnreadBadgeCount', () => {
  it('caps at 9+ and hides non-positive counts', () => {
    assert.equal(formatUnreadBadgeCount(0), '');
    assert.equal(formatUnreadBadgeCount(-1), '');
    assert.equal(formatUnreadBadgeCount(''), '');
    assert.equal(formatUnreadBadgeCount(1), '1');
    assert.equal(formatUnreadBadgeCount(9), '9');
    assert.equal(formatUnreadBadgeCount(10), '9+');
    assert.equal(formatUnreadBadgeCount(99), '9+');
  });
});

describe('shouldAutoShowUpdates', () => {
  const hour = 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  it('shows when there are unread updates and nothing was shown this session', () => {
    assert.equal(shouldAutoShowUpdates({ unreadCount: 2, lastShownAt: null, now }), true);
    assert.equal(shouldAutoShowUpdates({ unreadCount: 1, lastShownAt: '', now }), true);
    assert.equal(shouldAutoShowUpdates({ unreadCount: 1, lastShownAt: 'nope', now }), false);
  });

  it('shows again only after more than one hour', () => {
    assert.equal(shouldAutoShowUpdates({ unreadCount: 1, lastShownAt: String(now - hour - 1), now }), true);
    assert.equal(shouldAutoShowUpdates({ unreadCount: 1, lastShownAt: String(now - hour), now }), false);
    assert.equal(shouldAutoShowUpdates({ unreadCount: 1, lastShownAt: String(now - 1000), now }), false);
  });

  it('never auto-shows when unread count is 0', () => {
    assert.equal(shouldAutoShowUpdates({ unreadCount: 0, lastShownAt: null, now }), false);
    assert.equal(shouldAutoShowUpdates({ unreadCount: '0', lastShownAt: null, now }), false);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowQuickNotifications } from '../src/utils/quickNotifyVisibility.js';

describe('shouldShowQuickNotifications', () => {
  it('shows the button only for a signed-in employee', () => {
    assert.equal(shouldShowQuickNotifications({ user: { id: 4, role: 'employee' }, isAdmin: false }), true);
  });

  it('hides it for admins, including when an admin user object is present', () => {
    assert.equal(shouldShowQuickNotifications({ user: { id: 1, role: 'admin' }, isAdmin: true }), false);
  });

  it('hides it when nobody is signed in', () => {
    assert.equal(shouldShowQuickNotifications({ user: null, isAdmin: false }), false);
    assert.equal(shouldShowQuickNotifications({ user: null, isAdmin: true }), false);
    assert.equal(shouldShowQuickNotifications({}), false);
  });
});

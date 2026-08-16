import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLoginUnread,
  countLoginUnread,
  resolveCreatePending,
  coerceShowOnLogin,
  coerceIsActive,
  coerceUpdateType,
  coerceUpdatePriority,
  coerceUpdateVersion,
} from '../utils/systemUpdateMath.js';

describe('isLoginUnread / countLoginUnread', () => {
  it('counts only unread rows with show_on_login === 1', () => {
    assert.equal(isLoginUnread({ is_read: false, show_on_login: 1 }), true);
    assert.equal(isLoginUnread({ is_read: true, show_on_login: 1 }), false);
    assert.equal(isLoginUnread({ is_read: false, show_on_login: 0 }), false);
    assert.equal(isLoginUnread({ is_read: false, show_on_login: '1' }), false);
    assert.equal(isLoginUnread({ is_read: false, show_on_login: true }), false);
    assert.equal(isLoginUnread({ is_read: false }), false);

    assert.equal(
      countLoginUnread([
        { is_read: false, show_on_login: 1 },
        { is_read: false, show_on_login: 1 },
        { is_read: true, show_on_login: 1 },
        { is_read: false, show_on_login: 0 },
        { is_read: false, show_on_login: '1' },
      ]),
      2
    );
    assert.equal(countLoginUnread([]), 0);
    assert.equal(countLoginUnread(null), 0);
  });
});

describe('resolveCreatePending', () => {
  it('starts pending unless auto_approve is truthy', () => {
    assert.equal(resolveCreatePending(undefined), 1);
    assert.equal(resolveCreatePending(null), 1);
    assert.equal(resolveCreatePending(false), 1);
    assert.equal(resolveCreatePending(0), 1);
    assert.equal(resolveCreatePending(''), 1);

    assert.equal(resolveCreatePending(true), 0);
    assert.equal(resolveCreatePending(1), 0);
    assert.equal(resolveCreatePending('true'), 0);
    // Current route: non-empty strings are truthy, including the string "false".
    assert.equal(resolveCreatePending('false'), 0);
  });
});

describe('coerceShowOnLogin', () => {
  it('defaults omitted values to 1 and uses truthiness otherwise', () => {
    assert.equal(coerceShowOnLogin(undefined), 1);
    assert.equal(coerceShowOnLogin(true), 1);
    assert.equal(coerceShowOnLogin(1), 1);
    assert.equal(coerceShowOnLogin('1'), 1);

    assert.equal(coerceShowOnLogin(false), 0);
    assert.equal(coerceShowOnLogin(0), 0);
    assert.equal(coerceShowOnLogin(''), 0);
    assert.equal(coerceShowOnLogin(null), 0);
  });
});

describe('coerceIsActive', () => {
  it('resets to active when the field is omitted (current PUT behavior)', () => {
    assert.equal(coerceIsActive(undefined), 1);
    assert.equal(coerceIsActive(true), 1);
    assert.equal(coerceIsActive(1), 1);
    assert.equal(coerceIsActive(false), 0);
    assert.equal(coerceIsActive(0), 0);
    assert.equal(coerceIsActive(null), 0);
    assert.equal(coerceIsActive(''), 0);
  });
});

describe('coerceUpdateType / priority / version', () => {
  it('falls back with || so empty strings become defaults', () => {
    assert.equal(coerceUpdateType('bugfix'), 'bugfix');
    assert.equal(coerceUpdateType(''), 'feature');
    assert.equal(coerceUpdateType(null), 'feature');
    assert.equal(coerceUpdateType(undefined), 'feature');

    assert.equal(coerceUpdatePriority('high'), 'high');
    assert.equal(coerceUpdatePriority(''), 'medium');
    assert.equal(coerceUpdatePriority(0), 'medium');
    assert.equal(coerceUpdatePriority(undefined), 'medium');

    assert.equal(coerceUpdateVersion('1.2.3'), '1.2.3');
    assert.equal(coerceUpdateVersion(''), null);
    assert.equal(coerceUpdateVersion(0), null);
    assert.equal(coerceUpdateVersion(undefined), null);
  });
});

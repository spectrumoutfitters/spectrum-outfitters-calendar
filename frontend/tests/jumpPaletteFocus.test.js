import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTabWrapTarget,
  scheduleFocusRestore,
} from '../src/components/Layout/jumpPaletteFocus.js';

test('Tab wraps from the last focusable element to the first', () => {
  const first = { id: 'search' };
  const middle = { id: 'result' };
  const last = { id: 'close' };

  assert.equal(getTabWrapTarget([first, middle, last], last, false), first);
  assert.equal(getTabWrapTarget([first, middle, last], middle, false), null);
});

test('Shift+Tab wraps from the first focusable element to the last', () => {
  const first = { id: 'search' };
  const middle = { id: 'result' };
  const last = { id: 'close' };

  assert.equal(getTabWrapTarget([first, middle, last], first, true), last);
  assert.equal(getTabWrapTarget([first, middle, last], middle, true), null);
});

test('Tab trapping is inert when no focusable elements exist', () => {
  assert.equal(getTabWrapTarget([], null, false), null);
  assert.equal(getTabWrapTarget(null, null, true), null);
});

test('focus restoration waits for the next frame and supports effect cleanup', () => {
  const element = {
    focusCalls: 0,
    focus() {
      this.focusCalls += 1;
    },
  };
  let scheduled;
  let cancelled;
  const cleanup = scheduleFocusRestore(element, {
    requestFrame(callback) {
      scheduled = callback;
      return 73;
    },
    cancelFrame(id) {
      cancelled = id;
    },
    contains(candidate) {
      return candidate === element;
    },
  });

  assert.equal(element.focusCalls, 0);
  scheduled();
  assert.equal(element.focusCalls, 1);

  cleanup();
  assert.equal(cancelled, 73);
});

test('focus restoration skips an opener removed from the document', () => {
  const element = {
    focusCalls: 0,
    focus() {
      this.focusCalls += 1;
    },
  };
  let scheduled;
  scheduleFocusRestore(element, {
    requestFrame(callback) {
      scheduled = callback;
      return 1;
    },
    cancelFrame() {},
    contains() {
      return false;
    },
  });

  scheduled();
  assert.equal(element.focusCalls, 0);
});

test('focus restoration ignores elements that become unfocusable', () => {
  const element = {
    focus() {
      throw new Error('detached during close');
    },
  };
  let scheduled;
  scheduleFocusRestore(element, {
    requestFrame(callback) {
      scheduled = callback;
      return 1;
    },
    cancelFrame() {},
    contains() {
      return true;
    },
  });

  assert.doesNotThrow(() => scheduled());
});

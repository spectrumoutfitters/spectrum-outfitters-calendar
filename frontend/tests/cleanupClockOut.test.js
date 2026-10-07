import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildCleanupConfirmPayload, buildQuickClockOutBody } from '../src/utils/cleanupClockOut.js';

describe('buildCleanupConfirmPayload', () => {
  it('records cleanup as done even when the reminder boxes are not part of the payload', () => {
    assert.deepEqual(buildCleanupConfirmPayload('left vehicle on lift'), {
      cleanup_completed: true,
      notes: 'left vehicle on lift',
    });
  });

  it('stores blank notes as null', () => {
    assert.deepEqual(buildCleanupConfirmPayload('   '), {
      cleanup_completed: true,
      notes: null,
    });
    assert.deepEqual(buildCleanupConfirmPayload(null), {
      cleanup_completed: true,
      notes: null,
    });
    assert.deepEqual(buildCleanupConfirmPayload(undefined), {
      cleanup_completed: true,
      notes: null,
    });
  });

  it('trims surrounding whitespace and keeps the note text', () => {
    assert.deepEqual(buildCleanupConfirmPayload('  check Monday  '), {
      cleanup_completed: true,
      notes: 'check Monday',
    });
  });
});

describe('buildQuickClockOutBody', () => {
  it('never sends a lunch deduction with the quick clock-out', () => {
    assert.deepEqual(
      buildQuickClockOutBody(buildCleanupConfirmPayload('  left on lift  ')),
      {
        break_minutes: 0,
        notes: 'left on lift',
        cleanup_completed: true,
      },
    );
  });

  it('keeps a blank checklist note null on the clock-out request', () => {
    assert.deepEqual(buildQuickClockOutBody(buildCleanupConfirmPayload(' \n ')), {
      break_minutes: 0,
      notes: null,
      cleanup_completed: true,
    });
  });
});

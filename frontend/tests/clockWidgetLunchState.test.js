import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isStillOnLunchBreak } from '../src/utils/clockWidgetLunchState.js';

describe('isStillOnLunchBreak', () => {
  it('is false when there is no lunch clock-out', () => {
    assert.equal(isStillOnLunchBreak(null), false);
    assert.equal(isStillOnLunchBreak([]), false);
    assert.equal(
      isStillOnLunchBreak([
        { id: 1, clock_in: '2026-07-15T13:00:00.000Z', clock_out: '2026-07-15T17:00:00.000Z', notes: 'done' },
      ]),
      false,
    );
  });

  it('is true after a lunch clock-out with no later clock-in', () => {
    assert.equal(
      isStillOnLunchBreak([
        {
          id: 2,
          clock_in: '2026-07-15T13:00:00.000Z',
          clock_out: '2026-07-15T17:00:00.000Z',
          notes: 'Lunch break',
        },
      ]),
      true,
    );
  });

  it('clears lunch when any later clock-in exists, including the next day', () => {
    const lunch = {
      id: 2,
      clock_in: '2026-07-15T13:00:00.000Z',
      clock_out: '2026-07-15T17:00:00.000Z',
      notes: 'lunch break',
    };
    const nextDay = {
      id: 3,
      clock_in: '2026-07-16T13:00:00.000Z',
      clock_out: null,
      notes: null,
    };
    assert.equal(isStillOnLunchBreak([lunch, nextDay]), false);
  });

  it('ignores the lunch row itself even if its clock-in is after clock-out', () => {
    assert.equal(
      isStillOnLunchBreak([
        {
          id: 2,
          clock_in: '2026-07-15T18:00:00.000Z',
          clock_out: '2026-07-15T17:00:00.000Z',
          notes: 'lunch break',
        },
      ]),
      true,
    );
  });

  it('uses the latest lunch clock-out when several exist', () => {
    const earlier = {
      id: 1,
      clock_in: '2026-07-15T13:00:00.000Z',
      clock_out: '2026-07-15T16:00:00.000Z',
      notes: 'lunch break',
    };
    const returned = {
      id: 2,
      clock_in: '2026-07-15T17:00:00.000Z',
      clock_out: '2026-07-15T21:00:00.000Z',
      notes: null,
    };
    const laterLunch = {
      id: 3,
      clock_in: '2026-07-15T18:00:00.000Z',
      clock_out: '2026-07-15T22:00:00.000Z',
      notes: 'LUNCH BREAK — afternoon',
    };
    assert.equal(isStillOnLunchBreak([returned, earlier, laterLunch]), true);

    const afterLater = {
      id: 4,
      clock_in: '2026-07-15T22:30:00.000Z',
      notes: '',
    };
    assert.equal(isStillOnLunchBreak([earlier, laterLunch, afterLater]), false);
  });

  it('does not treat unrelated notes or missing clock-out as lunch', () => {
    assert.equal(
      isStillOnLunchBreak([
        { id: 1, clock_out: '2026-07-15T17:00:00.000Z', notes: 'lunch meeting' },
        { id: 2, clock_in: '2026-07-15T13:00:00.000Z', notes: 'lunch break' },
      ]),
      false,
    );
  });
});

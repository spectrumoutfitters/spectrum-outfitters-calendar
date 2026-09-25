import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPunchesByType,
  lunchHistoryParams,
  punchHistoryParams,
} from '../src/utils/adminHistoryQuery.js';

describe('lunchHistoryParams', () => {
  it('sends calendar dates without a time suffix', () => {
    assert.deepEqual(lunchHistoryParams({ from: '2026-09-01', to: '2026-09-07' }), {
      from: '2026-09-01',
      to: '2026-09-07',
    });
  });

  it('adds user_id only when an employee is selected', () => {
    assert.deepEqual(lunchHistoryParams({ from: '2026-09-01', to: '2026-09-07', userId: '' }), {
      from: '2026-09-01',
      to: '2026-09-07',
    });
    assert.deepEqual(lunchHistoryParams({ from: '2026-09-01', to: '2026-09-07', userId: '14' }), {
      from: '2026-09-01',
      to: '2026-09-07',
      user_id: '14',
    });
  });
});

describe('punchHistoryParams', () => {
  it('bounds the range with literal UTC timestamps, not a Houston offset', () => {
    assert.deepEqual(punchHistoryParams({ from: '2026-09-01', to: '2026-09-07' }), {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-07T23:59:59.999Z',
    });
  });

  it('keeps the employee filter on the UTC window', () => {
    const params = punchHistoryParams({ from: '2026-09-18', to: '2026-09-18', userId: '3' });
    assert.equal(params.from, '2026-09-18T00:00:00.000Z');
    assert.equal(params.to, '2026-09-18T23:59:59.999Z');
    assert.equal(params.user_id, '3');
  });
});

describe('filterPunchesByType', () => {
  const punches = [
    { id: 1, type: 'clock_in' },
    { id: 2, type: 'lunch_out' },
    { id: 3, type: 'lunch_in' },
    { id: 4, type: 'clock_out' },
  ];

  it('returns every punch when the type filter is empty', () => {
    assert.deepEqual(filterPunchesByType(punches, ''), punches);
    assert.deepEqual(filterPunchesByType(null, ''), []);
  });

  it('matches the punch type exactly', () => {
    assert.deepEqual(filterPunchesByType(punches, 'lunch_out'), [{ id: 2, type: 'lunch_out' }]);
    assert.deepEqual(filterPunchesByType(punches, 'Lunch_Out'), []);
    assert.deepEqual(filterPunchesByType(undefined, 'clock_in'), []);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePayrollHistoryAutoSyncGate,
  parsePayrollHistorySyncStatus,
} from '../utils/payrollHistoryAutoSyncGate.js';

describe('evaluatePayrollHistoryAutoSyncGate', () => {
  it('skips non-Saturday runs unless forced', () => {
    for (const dayOfWeek of [0, 1, 2, 3, 4, 5]) {
      const result = evaluatePayrollHistoryAutoSyncGate({
        today: '2026-07-15',
        dayOfWeek,
        lastSyncDate: null,
      });
      assert.deepEqual(result, {
        ran: false,
        reason: 'not_saturday',
        today: '2026-07-15',
      });
    }
  });

  it('skips Saturday when already synced today', () => {
    const result = evaluatePayrollHistoryAutoSyncGate({
      today: '2026-07-18',
      dayOfWeek: 6,
      lastSyncDate: '2026-07-18',
    });
    assert.deepEqual(result, {
      ran: false,
      reason: 'already_ran_today',
      today: '2026-07-18',
    });
  });

  it('allows Saturday when last sync was a different day', () => {
    const result = evaluatePayrollHistoryAutoSyncGate({
      today: '2026-07-18',
      dayOfWeek: 6,
      lastSyncDate: '2026-07-11',
    });
    assert.deepEqual(result, { shouldRun: true, today: '2026-07-18' });
  });

  it('allows Saturday when never synced', () => {
    const result = evaluatePayrollHistoryAutoSyncGate({
      today: '2026-07-18',
      dayOfWeek: 6,
      lastSyncDate: null,
    });
    assert.deepEqual(result, { shouldRun: true, today: '2026-07-18' });
  });

  it('force bypasses weekday and already-ran gates', () => {
    assert.deepEqual(
      evaluatePayrollHistoryAutoSyncGate({
        force: true,
        today: '2026-07-15',
        dayOfWeek: 3,
        lastSyncDate: '2026-07-15',
      }),
      { shouldRun: true, today: '2026-07-15' }
    );
  });
});

describe('parsePayrollHistorySyncStatus', () => {
  it('returns null for empty or corrupt values', () => {
    assert.equal(parsePayrollHistorySyncStatus(null), null);
    assert.equal(parsePayrollHistorySyncStatus(''), null);
    assert.equal(parsePayrollHistorySyncStatus('{not-json'), null);
  });

  it('parses successful and failed status payloads', () => {
    assert.deepEqual(
      parsePayrollHistorySyncStatus(
        JSON.stringify({
          ok: true,
          reason: 'manual',
          imported: 3,
          total: 10,
        })
      ),
      { ok: true, reason: 'manual', imported: 3, total: 10 }
    );
    assert.deepEqual(
      parsePayrollHistorySyncStatus(
        JSON.stringify({
          ok: false,
          reason: 'scheduled_saturday',
          error: 'ENOENT',
        })
      ),
      { ok: false, reason: 'scheduled_saturday', error: 'ENOENT' }
    );
  });
});

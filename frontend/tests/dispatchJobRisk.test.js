import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { jobRisk, fmtElapsed } from '../src/utils/dispatchJobRisk.js';

describe('jobRisk', () => {
  it('returns ok when estimate or elapsed is missing', () => {
    assert.equal(jobRisk({}), 'ok');
    assert.equal(jobRisk({ estimated_hours: 2 }), 'ok');
    assert.equal(jobRisk({ elapsed_minutes: 60 }), 'ok');
    assert.equal(jobRisk({ estimated_hours: 0, elapsed_minutes: 60 }), 'ok');
  });

  it('returns ok below 80% of estimate', () => {
    // 1h estimate, 47m → ~0.783
    assert.equal(jobRisk({ estimated_hours: 1, elapsed_minutes: 47 }), 'ok');
  });

  it('returns warning at or above 80% of estimate', () => {
    // 1h estimate, 48m → 0.8
    assert.equal(jobRisk({ estimated_hours: 1, elapsed_minutes: 48 }), 'warning');
    assert.equal(jobRisk({ estimated_hours: 2, elapsed_minutes: 100 }), 'warning');
  });

  it('returns overdue at or above 100% of estimate', () => {
    assert.equal(jobRisk({ estimated_hours: 1, elapsed_minutes: 60 }), 'overdue');
    assert.equal(jobRisk({ estimated_hours: 2, elapsed_minutes: 150 }), 'overdue');
  });
});

describe('fmtElapsed', () => {
  it('returns null for nullish minutes', () => {
    assert.equal(fmtElapsed(null), null);
    assert.equal(fmtElapsed(undefined), null);
  });

  it('formats minutes-only and hours+minutes', () => {
    assert.equal(fmtElapsed(0), '0m');
    assert.equal(fmtElapsed(45), '45m');
    assert.equal(fmtElapsed(60), '1h 0m');
    assert.equal(fmtElapsed(125), '2h 5m');
  });
});

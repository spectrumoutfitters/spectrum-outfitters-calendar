import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAdminApiError,
  rafflePoolOdds,
} from '../src/lib/raffleAdminDashboardMath.js';

describe('formatAdminApiError', () => {
  it('maps unauthorized, timeout, and missing Apps Script URL', () => {
    assert.match(formatAdminApiError('unauthorized'), /Admin key was rejected/);
    assert.match(formatAdminApiError('apps_script_timeout'), /took too long to respond/);
    assert.match(formatAdminApiError('server_misconfigured'), /missing APPS_SCRIPT_URL/);
    assert.match(formatAdminApiError('server_misconfigured'), /script\.google\.com/);
  });

  it('falls back when the code is missing and passes unknown codes through', () => {
    assert.equal(formatAdminApiError(undefined), 'Request failed');
    assert.equal(formatAdminApiError(''), 'Request failed');
    assert.equal(formatAdminApiError('draw_failed'), 'draw_failed');
  });
});

describe('rafflePoolOdds', () => {
  it('labels empty pools and distinguishes people-without-tickets', () => {
    assert.deepEqual(rafflePoolOdds(0, 0), {
      oneIn: '—',
      pctLabel: 'No tickets yet',
      avgTickets: '—',
    });
    assert.deepEqual(rafflePoolOdds(0, 3), {
      oneIn: '—',
      pctLabel: 'No tickets yet',
      avgTickets: '0',
    });
    assert.equal(rafflePoolOdds(-1, 1).pctLabel, 'No tickets yet');
  });

  it('rounds percent labels at the 10% and 1% thresholds', () => {
    const ten = rafflePoolOdds(10, 2);
    assert.equal(ten.oneIn, '1 in 10');
    assert.equal(ten.pctLabel, '~10% per ticket');
    assert.equal(ten.avgTickets, '5.00');

    const eleven = rafflePoolOdds(11, 2);
    assert.equal(eleven.pctLabel, '~9.1% per ticket');

    const twoHundred = rafflePoolOdds(200, 4);
    assert.equal(twoHundred.pctLabel, '~0.50% per ticket');
  });

  it('uses one decimal for avg tickets when people > 5, else two; no people shows ticket count', () => {
    assert.equal(rafflePoolOdds(100, 6).avgTickets, '16.7');
    assert.equal(rafflePoolOdds(100, 5).avgTickets, '20.00');
    assert.equal(rafflePoolOdds(7, 0).avgTickets, '7');
    assert.equal(rafflePoolOdds(1, 0).pctLabel, '~100% per ticket');
  });
});

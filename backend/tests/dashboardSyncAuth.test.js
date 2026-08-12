import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDashboardSyncToken,
  dashboardSyncTokenConfigured,
  dashboardSyncTokenMatches,
} from '../utils/dashboardSyncAuth.js';

describe('dashboardSyncAuth', () => {
  const prev = process.env.DASHBOARD_SYNC_TOKEN;

  before(() => {
    process.env.DASHBOARD_SYNC_TOKEN = 'test-sync-secret';
  });

  after(() => {
    if (prev === undefined) delete process.env.DASHBOARD_SYNC_TOKEN;
    else process.env.DASHBOARD_SYNC_TOKEN = prev;
  });

  it('extracts Bearer, header, and query tokens in priority order', () => {
    assert.equal(
      extractDashboardSyncToken({
        headers: { authorization: 'Bearer from-bearer', 'x-dashboard-sync-token': 'from-header' },
        query: { token: 'from-query' },
      }),
      'from-bearer'
    );
    assert.equal(
      extractDashboardSyncToken({
        headers: { 'x-dashboard-sync-token': 'from-header' },
        query: { token: 'from-query' },
      }),
      'from-header'
    );
    assert.equal(
      extractDashboardSyncToken({
        headers: {},
        query: { token: 'from-query' },
      }),
      'from-query'
    );
  });

  it('matches only the configured sync token', () => {
    assert.equal(dashboardSyncTokenConfigured(), true);
    assert.equal(dashboardSyncTokenMatches('test-sync-secret'), true);
    assert.equal(dashboardSyncTokenMatches('wrong'), false);
    assert.equal(dashboardSyncTokenMatches(''), false);
  });

  it('rejects when env token is unset', () => {
    delete process.env.DASHBOARD_SYNC_TOKEN;
    assert.equal(dashboardSyncTokenConfigured(), false);
    assert.equal(dashboardSyncTokenMatches('test-sync-secret'), false);
    process.env.DASHBOARD_SYNC_TOKEN = 'test-sync-secret';
  });
});

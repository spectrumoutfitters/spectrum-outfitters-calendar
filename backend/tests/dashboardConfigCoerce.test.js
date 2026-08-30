import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceDashboardConfigPayload,
  applyForceSyncRequest,
} from '../utils/dashboardConfigCoerce.js';

const NOW = '2026-08-30T05:00:00.000Z';

describe('coerceDashboardConfigPayload', () => {
  it('keeps arrays and a truthy spectrumServer object', () => {
    const items = [{ id: 1 }];
    const categoryOrder = ['a', 'b'];
    const spectrumServer = { url: 'https://assistant.example', password: 'secret' };
    const r = coerceDashboardConfigPayload(
      { items, categoryOrder, spectrumServer, updatedAt: '2026-01-01T00:00:00.000Z' },
      NOW
    );
    assert.equal(r.items, items);
    assert.equal(r.categoryOrder, categoryOrder);
    assert.equal(r.spectrumServer, spectrumServer);
    assert.equal(r.updatedAt, '2026-01-01T00:00:00.000Z');
  });

  it('coerces non-array items/categoryOrder to empty arrays', () => {
    const r = coerceDashboardConfigPayload(
      { items: { id: 1 }, categoryOrder: 'a,b', spectrumServer: { url: 'x' } },
      NOW
    );
    assert.deepEqual(r.items, []);
    assert.deepEqual(r.categoryOrder, []);
    assert.deepEqual(r.spectrumServer, { url: 'x' });
  });

  it('drops falsy / non-object spectrumServer (arrays are kept — typeof [] === object)', () => {
    assert.equal(coerceDashboardConfigPayload({ spectrumServer: null }, NOW).spectrumServer, null);
    assert.equal(coerceDashboardConfigPayload({ spectrumServer: '' }, NOW).spectrumServer, null);
    assert.equal(coerceDashboardConfigPayload({ spectrumServer: 0 }, NOW).spectrumServer, null);
    assert.equal(coerceDashboardConfigPayload({ spectrumServer: 'host' }, NOW).spectrumServer, null);
    const arr = [{ host: 'x' }];
    assert.equal(coerceDashboardConfigPayload({ spectrumServer: arr }, NOW).spectrumServer, arr);
  });

  it('uses nowIso when updatedAt is missing or falsy', () => {
    assert.equal(coerceDashboardConfigPayload({}, NOW).updatedAt, NOW);
    assert.equal(coerceDashboardConfigPayload({ updatedAt: '' }, NOW).updatedAt, NOW);
    assert.equal(coerceDashboardConfigPayload({ updatedAt: 0 }, NOW).updatedAt, NOW);
  });
});

describe('applyForceSyncRequest', () => {
  const state = {
    forceSyncRequestedAt: null,
    forceSyncClientIds: ['already'],
    clients: { a: {}, b: {}, already: {} },
  };

  it('targets one trimmed client id without duplicating', () => {
    const r = applyForceSyncRequest(state, '  a  ', NOW);
    assert.deepEqual(r.forceSyncClientIds, ['already', 'a']);
    assert.equal(r.forceSyncRequestedAt, null);
    assert.equal(r.forClientId, 'a');
    const dup = applyForceSyncRequest(state, 'already', NOW);
    assert.deepEqual(dup.forceSyncClientIds, ['already']);
  });

  it('empty / whitespace clientId stamps now and unions every known client', () => {
    const r = applyForceSyncRequest(state, '', NOW);
    assert.equal(r.forceSyncRequestedAt, NOW);
    assert.deepEqual(r.forceSyncClientIds, ['already', 'a', 'b']);
    assert.equal(r.forClientId, null);
    const ws = applyForceSyncRequest(state, '   ', NOW);
    assert.equal(ws.forClientId, null);
    assert.equal(ws.forceSyncRequestedAt, NOW);
  });

  it('treats a missing forceSyncClientIds / clients object as empty', () => {
    const r = applyForceSyncRequest({}, undefined, NOW);
    assert.deepEqual(r.forceSyncClientIds, []);
    assert.equal(r.forceSyncRequestedAt, NOW);
    assert.equal(r.forClientId, null);
  });
});

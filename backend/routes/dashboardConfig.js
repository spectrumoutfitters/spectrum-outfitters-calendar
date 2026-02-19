/**
 * Dashboard Assistant sync API — piggybacks on the Spectrum Outfitters Calendar server.
 * GET: return last pushed config (so downloaded apps stay in sync).
 * POST: save config (master push from Spectrum Outfitters Assistant).
 * GET /check: clients poll to see if they should pull; records lastSeenAt.
 * POST /sync-report: client reports after a pull (records lastSyncAt).
 * GET /clients: (admin) list who synced and when.
 * POST /force-sync: (admin) request one or all clients to pull.
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const dataDir = path.join(__dirname, '..', 'data');
const configPath = path.join(dataDir, 'dashboard-config.json');
const syncStatePath = path.join(dataDir, 'dashboard-sync-state.json');

async function ensureDataDir() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (e) {
    console.error('dashboardConfig: could not create data dir', e?.message);
  }
}

async function readSyncState() {
  try {
    const raw = await fs.readFile(syncStatePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return { configUpdatedAt: null, clients: {}, forceSyncRequestedAt: null, forceSyncClientIds: [] };
    console.error('dashboardConfig readSyncState:', e?.message);
    return { configUpdatedAt: null, clients: {}, forceSyncRequestedAt: null, forceSyncClientIds: [] };
  }
}

async function writeSyncState(state) {
  await ensureDataDir();
  await fs.writeFile(syncStatePath, JSON.stringify(state, null, 2), 'utf8');
}

/** GET — return last pushed config (for Pull / auto-sync) */
router.get('/', async (req, res) => {
  try {
    await ensureDataDir();
    const raw = await fs.readFile(configPath, 'utf8');
    const data = JSON.parse(raw);
    res.json(data);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ error: 'No dashboard config pushed yet' });
    }
    console.error('dashboardConfig GET:', e?.message);
    res.status(500).json({ error: 'Failed to read config' });
  }
});

/** POST — save config (master Push from Spectrum Outfitters Assistant) */
router.post('/', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    await ensureDataDir();
    const updatedAt = body.updatedAt || new Date().toISOString();
    const payload = {
      items: Array.isArray(body.items) ? body.items : [],
      categoryOrder: Array.isArray(body.categoryOrder) ? body.categoryOrder : [],
      spectrumServer: body.spectrumServer && typeof body.spectrumServer === 'object' ? body.spectrumServer : null,
      updatedAt
    };
    await fs.writeFile(configPath, JSON.stringify(payload, null, 2), 'utf8');

    const state = await readSyncState();
    state.configUpdatedAt = updatedAt;
    await writeSyncState(state);

    res.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (e) {
    console.error('dashboardConfig POST:', e?.message);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

/** GET /check?clientId=xxx — client polls; returns whether to pull; records lastSeenAt (no auth) */
router.get('/check', async (req, res) => {
  try {
    const clientId = (req.query.clientId || '').toString().trim();
    const state = await readSyncState();
    const now = new Date().toISOString();

    if (clientId) {
      if (!state.clients[clientId]) state.clients[clientId] = { clientName: '', lastSyncAt: null, lastSeenAt: null };
      state.clients[clientId].lastSeenAt = now;
      await writeSyncState(state);
    }

    const forceSyncForMe = clientId && Array.isArray(state.forceSyncClientIds) && state.forceSyncClientIds.includes(clientId);
    if (forceSyncForMe && clientId) {
      state.forceSyncClientIds = (state.forceSyncClientIds || []).filter((id) => id !== clientId);
      await writeSyncState(state);
    }

    const forceSyncRequestedAt = state.forceSyncRequestedAt || null;
    res.json({
      configUpdatedAt: state.configUpdatedAt || null,
      forceSyncRequestedAt,
      forceSyncForMe: !!forceSyncForMe
    });
  } catch (e) {
    console.error('dashboardConfig GET /check:', e?.message);
    res.status(500).json({ error: 'Failed to check sync' });
  }
});

/** POST /sync-report — client reports after pull (no auth) */
router.post('/sync-report', express.json({ limit: '1kb' }), async (req, res) => {
  try {
    const clientId = (req.body?.clientId || '').toString().trim();
    const clientName = (req.body?.clientName || '').toString().trim();
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const state = await readSyncState();
    if (!state.clients[clientId]) state.clients[clientId] = { clientName: '', lastSyncAt: null, lastSeenAt: null };
    const now = new Date().toISOString();
    state.clients[clientId].lastSyncAt = now;
    state.clients[clientId].lastSeenAt = now;
    if (clientName) state.clients[clientId].clientName = clientName;
    await writeSyncState(state);

    res.json({ ok: true });
  } catch (e) {
    console.error('dashboardConfig POST /sync-report:', e?.message);
    res.status(500).json({ error: 'Failed to report sync' });
  }
});

/** GET /clients — (admin) list clients who have synced / been seen */
router.get('/clients', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const state = await readSyncState();
    const clients = Object.entries(state.clients || {}).map(([clientId, c]) => ({
      clientId,
      clientName: c.clientName || '(no name)',
      lastSyncAt: c.lastSyncAt || null,
      lastSeenAt: c.lastSeenAt || null
    }));
    clients.sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''));
    res.json({ clients });
  } catch (e) {
    console.error('dashboardConfig GET /clients:', e?.message);
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

/** POST /force-sync — (admin) request clients to pull: body { clientId?: string } — omit for everyone */
router.post('/force-sync', authenticateToken, requireAdmin, express.json({ limit: '1kb' }), async (req, res) => {
  try {
    const state = await readSyncState();
    const clientId = (req.body?.clientId || '').toString().trim();
    const now = new Date().toISOString();

    state.forceSyncClientIds = state.forceSyncClientIds || [];
    if (clientId) {
      if (!state.forceSyncClientIds.includes(clientId)) state.forceSyncClientIds.push(clientId);
    } else {
      state.forceSyncRequestedAt = now;
      const allIds = Object.keys(state.clients || {});
      allIds.forEach((id) => {
        if (!state.forceSyncClientIds.includes(id)) state.forceSyncClientIds.push(id);
      });
    }
    await writeSyncState(state);

    res.json({ ok: true, forClientId: clientId || null });
  } catch (e) {
    console.error('dashboardConfig POST /force-sync:', e?.message);
    res.status(500).json({ error: 'Failed to request force sync' });
  }
});

export default router;

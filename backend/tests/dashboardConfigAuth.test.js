import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spectrum-dashboard-config-'));
process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
process.env.JWT_SECRET = 'test-secret';
process.env.DASHBOARD_SYNC_TOKEN = 'sync-secret-for-tests';

const { default: db } = await import('../database/db.js');
const { extractDashboardSyncToken, dashboardSyncTokenMatches } = await import(
  '../utils/dashboardSyncAuth.js'
);
const { authenticateToken, requireAdmin } = await import('../middleware/auth.js');

function requireDashboardConfigAccess(req, res, next) {
  if (dashboardSyncTokenMatches(extractDashboardSyncToken(req))) {
    return next();
  }
  return authenticateToken(req, res, () => requireAdmin(req, res, next));
}

const secretPayload = {
  items: [{ id: 'x', name: 'Demo', username: 'u', password: 'p' }],
  categoryOrder: [],
  spectrumServer: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function dispatch(req) {
  const res = makeResponse();
  await new Promise((resolve) => {
    const finish = () => resolve();
    const origJson = res.json.bind(res);
    res.json = (payload) => {
      origJson(payload);
      finish();
      return res;
    };
    requireDashboardConfigAccess(req, res, () => {
      res.json(secretPayload);
    });
  });
  return res;
}

describe('dashboard-config credential gate', () => {
  before(async () => {
    await db.runAsync(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        role TEXT,
        payroll_access INTEGER DEFAULT 0,
        is_master_admin INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      )
    `);
    await db.runAsync(
      'INSERT INTO users (id, username, role, payroll_access, is_master_admin, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'admin', 'admin', 1, 1, 1]
    );
  });

  after(async () => {
    await new Promise((resolve) => db.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('rejects unauthenticated GET (no token, no JWT)', async () => {
    const res = await dispatch({ headers: {}, query: {}, cookies: {} });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body?.items?.[0]?.password, undefined);
  });

  it('allows GET with valid sync token query param', async () => {
    const res = await dispatch({
      headers: {},
      query: { token: 'sync-secret-for-tests' },
      cookies: {},
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.items?.[0]?.password, 'p');
  });

  it('rejects GET with wrong sync token', async () => {
    const res = await dispatch({
      headers: {},
      query: { token: 'wrong' },
      cookies: {},
    });
    assert.equal(res.statusCode, 401);
  });

  it('allows GET with admin JWT', async () => {
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin' },
      process.env.JWT_SECRET
    );
    const res = await dispatch({
      headers: { authorization: `Bearer ${token}` },
      query: {},
      cookies: {},
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.items?.[0]?.name, 'Demo');
  });
});

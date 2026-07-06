import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spectrum-auth-security-'));
process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
process.env.JWT_SECRET = 'test-secret';

const { default: db } = await import('../database/db.js');
const { authenticateToken } = await import('../middleware/auth.js');
const { default: dashboardConfigRoutes } = await import('../routes/dashboardConfig.js');

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

function signUser(id, claims = {}) {
  return jwt.sign({ id, username: `token-user-${id}`, role: 'admin', ...claims }, process.env.JWT_SECRET);
}

async function callAuthenticate(token) {
  const req = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cookies: {},
  };
  const res = makeResponse();
  let nextCalled = false;
  await authenticateToken(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
}

describe('authentication security', () => {
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
      [1, 'active-admin', 'admin', 1, 1, 1]
    );
    await db.runAsync(
      'INSERT INTO users (id, username, role, payroll_access, is_master_admin, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [2, 'inactive-admin', 'admin', 1, 1, 0]
    );
  });

  after(async () => {
    await new Promise((resolve) => db.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('hydrates active users from the database before allowing protected routes', async () => {
    const { req, res, nextCalled } = await callAuthenticate(signUser(1, { role: 'employee' }));

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
    assert.equal(req.user.username, 'active-admin');
    assert.equal(req.user.role, 'admin');
    assert.equal(req.user.payroll_access, true);
    assert.equal(req.user.is_master_admin, true);
  });

  it('rejects tokens for deactivated users', async () => {
    const { res, nextCalled } = await callAuthenticate(signUser(2));

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });

  it('rejects tokens whose users no longer exist', async () => {
    const { res, nextCalled } = await callAuthenticate(signUser(999));

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });
});

describe('dashboard config security', () => {
  it('rejects unauthenticated config overwrites before writing JSON', async () => {
    const app = express();
    app.use('/api/dashboard-config', dashboardConfigRoutes);
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    try {
      const { port } = server.address();
      const response = await fetch(`http://127.0.0.1:${port}/api/dashboard-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: 'malicious' }] }),
      });

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'Authentication required' });
    } finally {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});

#!/usr/bin/env node

/**
 * Bug-check agent for Spectrum Outfitters.
 *
 * Runs a series of automated checks and exits 0 only if every check passes.
 * Designed to be called from CI (GitHub Actions) or locally before pushing.
 *
 * Usage:
 *   node scripts/check-bugs.js          # run all checks
 *   npm run check-bugs                  # same via npm
 *   npm run push-safe                   # run checks, then git push if all pass
 *
 * Checks performed:
 *   1. Dependency audit  – npm audit (warnings only, non-blocking)
 *   2. Frontend build    – vite build must succeed (catches import/JSX/syntax errors)
 *   3. Backend boot      – server.js must start and respond on /api/health
 *   4. API smoke tests   – login, create task, list tasks, list users, delete task
 */

import { execSync, spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

const PASS = '\x1b[32m\u2705 PASS\x1b[0m';
const FAIL = '\x1b[31m\u274c FAIL\x1b[0m';
const WARN = '\x1b[33m\u26a0\ufe0f  WARN\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let backendProc = null;
const results = [];
let exitCode = 0;

function log(msg) { console.log(msg); }
function section(title) { log(`\n${BOLD}\u2501\u2501\u2501 ${title} \u2501\u2501\u2501${RESET}`); }

function record(name, passed, detail = '') {
  const status = passed ? 'pass' : 'fail';
  results.push({ name, status, detail });
  if (!passed) exitCode = 1;
  log(`  ${passed ? PASS : FAIL}  ${name}${detail ? ` \u2014 ${detail}` : ''}`);
}

function recordWarn(name, detail = '') {
  results.push({ name, status: 'warn', detail });
  log(`  ${WARN}  ${name}${detail ? ` \u2014 ${detail}` : ''}`);
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 120_000, ...opts }).trim();
  } catch (e) {
    return e.stdout ? e.stdout.toString().trim() : '';
  }
}

function runStrict(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', timeout: 120_000, ...opts }).trim();
}

function httpGet(url, headers = {}, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: 'GET', headers,
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function httpPost(url, body, headers = {}, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const opts = {
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function httpDelete(url, headers = {}, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'DELETE', headers,
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// --- 1. Dependency audit ---
async function checkDeps() {
  section('Dependency Audit');
  for (const [label, dir] of [['root', ROOT], ['backend', BACKEND], ['frontend', FRONTEND]]) {
    try {
      runStrict(`npm audit --audit-level=critical`, { cwd: dir, stdio: 'pipe' });
      record(`${label} \u2014 no critical vulnerabilities`, true);
    } catch {
      recordWarn(`${label} \u2014 has vulnerabilities (review npm audit output)`);
    }
  }
}

// --- 2. Frontend build ---
async function checkFrontendBuild() {
  section('Frontend Build');
  try {
    runStrict('npm run build', { cwd: FRONTEND, stdio: 'pipe' });
    record('Frontend vite build', true);
  } catch (e) {
    record('Frontend vite build', false, (e.stderr || e.message || '').slice(0, 300));
  }
}

// --- 3. Backend boot ---
async function startBackend() {
  section('Backend Boot');

  const envPath = path.join(BACKEND, '.env');
  if (!fs.existsSync(envPath)) {
    record('backend/.env exists', false, 'Missing \u2014 create it with at least JWT_SECRET');
    return false;
  }
  record('backend/.env exists', true);

  const dbPath = path.join(BACKEND, 'database', 'shop_tasks.db');
  if (!fs.existsSync(dbPath)) {
    log('  \u2139\ufe0f  Database missing \u2014 running init-db...');
    try {
      runStrict('npm run init-db', { cwd: BACKEND, stdio: 'pipe' });
      record('Database initialized', true);
    } catch (e) {
      record('Database initialized', false, (e.message || '').slice(0, 200));
      return false;
    }
  }

  backendProc = spawn('node', ['server.js'], {
    cwd: BACKEND,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  let stderr = '';
  backendProc.stderr.on('data', (d) => (stderr += d.toString()));

  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await httpGet('http://localhost:5000/api/health');
      if (res.status === 200) {
        record('Backend starts and responds on /api/health', true);
        return true;
      }
    } catch { /* retry */ }
  }
  record('Backend starts and responds on /api/health', false, stderr.slice(0, 300));
  return false;
}

// --- 4. API smoke tests ---
async function checkAPIs() {
  section('API Smoke Tests');

  let token;
  try {
    const res = await httpPost('http://localhost:5000/api/auth/login', {
      username: 'admin', password: 'SpectrumAdmin2024!',
    });
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.token) {
      token = data.token;
      record('POST /api/auth/login', true);
    } else {
      record('POST /api/auth/login', false, `status=${res.status}`);
      return;
    }
  } catch (e) {
    record('POST /api/auth/login', false, e.message);
    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Create task
  let taskId;
  try {
    const res = await httpPost('http://localhost:5000/api/tasks', {
      title: 'Bug-Check Smoke Test', description: 'Auto-generated by check-bugs', priority: 'low', category: 'Admin', status: 'todo',
    }, authHeaders);
    const data = JSON.parse(res.body);
    if (res.status === 201 && data.task?.id) {
      taskId = data.task.id;
      record('POST /api/tasks (create)', true);
    } else {
      record('POST /api/tasks (create)', false, `status=${res.status} body=${res.body.slice(0, 200)}`);
    }
  } catch (e) {
    record('POST /api/tasks (create)', false, e.message);
  }

  // List tasks (authenticated)
  try {
    const res = await httpGet('http://localhost:5000/api/tasks', authHeaders);
    record('GET /api/tasks (list)', res.status === 200, `status=${res.status}`);
  } catch (e) {
    record('GET /api/tasks (list)', false, e.message);
  }

  // List users (admin-only)
  try {
    const res = await httpGet('http://localhost:5000/api/users', authHeaders);
    record('GET /api/users (list)', res.status === 200, `status=${res.status}`);
  } catch (e) {
    record('GET /api/users (list)', false, e.message);
  }

  // Delete the smoke-test task
  if (taskId) {
    try {
      const res = await httpDelete(`http://localhost:5000/api/tasks/${taskId}`, authHeaders);
      record('DELETE /api/tasks/:id (cleanup)', res.status === 200, `status=${res.status}`);
    } catch (e) {
      recordWarn('DELETE /api/tasks/:id (cleanup)', e.message);
    }
  }
}

// --- Summary ---
function printSummary() {
  section('Summary');
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  log(`\n  ${BOLD}Total: ${results.length}${RESET}  |  ${PASS} ${passed}  |  ${FAIL} ${failed}  |  ${WARN} ${warned}\n`);
  if (failed === 0) {
    log(`${BOLD}\x1b[32m  \ud83c\udf89 All checks passed \u2014 safe to push!${RESET}\n`);
  } else {
    log(`${BOLD}\x1b[31m  \ud83d\udeab ${failed} check(s) failed \u2014 fix before pushing.${RESET}\n`);
  }
}

// --- Main ---
async function main() {
  log(`\n${BOLD}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557${RESET}`);
  log(`${BOLD}\u2551   Spectrum Outfitters \u2014 Bug Check Agent        \u2551${RESET}`);
  log(`${BOLD}\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d${RESET}`);

  await checkDeps();
  await checkFrontendBuild();

  const backendOk = await startBackend();
  if (backendOk) {
    await checkAPIs();
  }

  printSummary();

  if (backendProc) {
    backendProc.kill('SIGTERM');
    await sleep(500);
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error('Bug check agent crashed:', e);
  if (backendProc) backendProc.kill('SIGTERM');
  process.exit(1);
});

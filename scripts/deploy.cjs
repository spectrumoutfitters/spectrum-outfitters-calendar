/**
 * Deploy Spectrum Outfitters Calendar to server.
 *
 * Usage:
 *   node scripts/deploy.cjs              # Full deploy (backend + frontend)
 *   node scripts/deploy.cjs --backend-only   # Only backend (skips frontend build/upload)
 *   node scripts/deploy.cjs --frontend-only # Only frontend (skips backend upload + server npm install)
 *   node scripts/deploy.cjs --force         # Full deploy but always upload all files (ignore cache)
 *   node scripts/deploy.cjs --with-env      # Include backend/.env in upload (e.g. after adding a new key)
 *
 * Incremental uploads: uses rsync when available; otherwise uses a local cache
 * (scripts/.deploy-cache.json) so only changed files are uploaded with scp (works on Windows).
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '..');
const configPath = path.join(scriptDir, 'deploy.config.json');
const cachePath = path.join(scriptDir, '.deploy-cache.json');

const args = process.argv.slice(2);
const backendOnly = args.includes('--backend-only');
const frontendOnly = args.includes('--frontend-only');
const force = args.includes('--force');
const withEnv = args.includes('--with-env');

if (!fs.existsSync(configPath)) {
  console.error('Missing scripts/deploy.config.json. Copy from deploy.config.example.json and set host, user, path.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { host, user, path: remotePath, sshKeyPath } = config;
const remote = `${user}@${host}`;
const sshOpt = sshKeyPath ? `-i "${sshKeyPath}"` : '';

// Prefer rsync when available. Else use cache-based incremental (scp only changed files).
let useRsync = false;
try {
  execSync('rsync --version', { stdio: 'pipe' });
  useRsync = true;
  console.log('Using rsync for incremental uploads.\n');
} catch {
  console.log('Using cache-based incremental uploads (no rsync).\n');
}

function quote(p) {
  return `"${String(p).replace(/"/g, '\\"')}"`;
}

function run(cmd, opts = {}) {
  console.log('>', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: opts.cwd || projectRoot, ...opts });
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return { backend: {}, frontend: {} };
  }
}

function saveCache(cache) {
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

/** Get map of relativePath -> { mtime, size } for dir, excluding node_modules, .env, *.db */
function getFileStats(dir, opts = {}) {
  const exclude = opts.exclude || (() => false);
  const map = {};
  const base = path.resolve(dir);
  function walk(d) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      const rel = path.relative(base, full).replace(/\\/g, '/');
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || exclude(rel)) continue;
        walk(full);
      } else {
        if (exclude(rel)) continue;
        const stat = fs.statSync(full);
        map[rel] = { mtime: stat.mtimeMs, size: stat.size };
      }
    }
  }
  walk(base);
  return map;
}

/** Which relative paths are new or changed (mtime/size) vs cache */
function getChangedPaths(current, cached) {
  const out = [];
  for (const [rel, cur] of Object.entries(current)) {
    const prev = cached[rel];
    if (!prev || prev.mtime !== cur.mtime || prev.size !== cur.size) out.push(rel);
  }
  return out;
}

const scpOpt = sshKeyPath ? `-i ${quote(sshKeyPath)}` : '';
const be = path.join(projectRoot, 'backend');
const feDist = path.join(projectRoot, 'frontend', 'dist');

function uploadBackend() {
  console.log('\n--- Uploading backend ---');
  if (useRsync) {
    const rsyncSsh = `ssh -o StrictHostKeyChecking=no ${sshKeyPath ? '-i "' + sshKeyPath + '"' : ''}`;
    const exclude = '--exclude=node_modules --exclude=.env --exclude=\'*.db\'';
    run(`rsync -avz ${exclude} -e ${quote(rsyncSsh)} ${quote(be + path.sep)} ${remote}:${remotePath}/backend/`);
    return;
  }
  const cache = loadCache();
  const beExclude = (rel) => rel.includes('.env') || rel.endsWith('.db');
  const current = getFileStats(be, { exclude: beExclude });
  const changed = force ? Object.keys(current) : getChangedPaths(current, cache.backend || {});

  if (changed.length === 0) {
    console.log('Backend: no changed files (skipping upload). Use --force to upload everything.');
    return;
  }

  const rootFiles = ['server.js', 'package.json', 'package-lock.json', 'reset_password.js', ...(withEnv ? ['.env'] : [])];
  const topDirs = ['routes', 'middleware', 'utils', 'database'];
  const changedTop = new Set(changed.map((p) => p.split('/')[0]));

  for (const f of rootFiles) {
    if (!changed.includes(f)) continue;
    const full = path.join(be, f);
    if (fs.existsSync(full))
      run(`scp ${scpOpt} ${quote(full)} ${remote}:${remotePath}/backend/`);
  }
  for (const dir of ['routes', 'middleware', 'utils']) {
    if (!changedTop.has(dir)) continue;
    const full = path.join(be, dir);
    if (fs.existsSync(full))
      run(`scp -r ${scpOpt} ${quote(full)} ${remote}:${remotePath}/backend/`);
  }
  if (changedTop.has('database')) {
    const dbDir = path.join(be, 'database');
    if (fs.existsSync(dbDir)) {
      run(`ssh ${sshKeyPath ? sshOpt + ' ' : ''}${remote} "mkdir -p ${remotePath}/backend/database"`);
      const dbFiles = fs.readdirSync(dbDir).filter((f) => f.endsWith('.js'));
      for (const f of dbFiles) {
        run(`scp ${scpOpt} ${quote(path.join(dbDir, f))} ${remote}:${remotePath}/backend/database/`);
      }
    }
  }

  cache.backend = current;
  saveCache(cache);
}

function uploadFrontendDist() {
  console.log('\n--- Uploading frontend/dist ---');
  if (useRsync) {
    const rsyncSsh = `ssh -o StrictHostKeyChecking=no ${sshKeyPath ? '-i "' + sshKeyPath + '"' : ''}`;
    run(`rsync -avz --delete -e ${quote(rsyncSsh)} ${quote(feDist + path.sep)} ${remote}:${remotePath}/frontend/dist/`);
    return;
  }
  const cache = loadCache();
  const current = getFileStats(feDist, {});
  const changed = force ? Object.keys(current) : getChangedPaths(current, cache.frontend || {});

  if (changed.length === 0) {
    console.log('Frontend: no changed files (skipping upload). Use --force to upload everything.');
    cache.frontend = current;
    saveCache(cache);
    return;
  }

  run(`scp -r ${scpOpt} ${quote(feDist)} ${remote}:${remotePath}/frontend/`);
  cache.frontend = current;
  saveCache(cache);
}

// 0. Ensure remote directories exist
console.log('\n--- Ensuring server directories exist ---');
run('ssh ' + (sshOpt ? sshOpt + ' ' : '') + remote + ' "mkdir -p ' + remotePath + '/backend ' + remotePath + '/frontend \'' + remotePath + '/Payroll System\'"');

if (!backendOnly) {
  // 1. Build frontend
  console.log('\n--- Building frontend ---');
  const buildEnv = { ...process.env, VITE_BASE_PATH: '' };
  run('npm run build', { cwd: path.join(projectRoot, 'frontend'), env: buildEnv });
  if (!fs.existsSync(feDist)) {
    console.error('frontend/dist not found after build.');
    process.exit(1);
  }
}

if (!frontendOnly) {
  uploadBackend();
}

if (!backendOnly) {
  uploadFrontendDist();
}

// Payroll System: only on full deploy
if (!backendOnly && !frontendOnly) {
  const payrollLocal = fs.existsSync(path.join(projectRoot, 'Payroll System'))
    ? path.join(projectRoot, 'Payroll System')
    : path.join(projectRoot, '..', 'Payroll System');
  if (fs.existsSync(payrollLocal)) {
    console.log('\n--- Uploading Payroll System ---');
    if (useRsync) {
      const rsyncSsh = `ssh -o StrictHostKeyChecking=no ${sshKeyPath ? '-i "' + sshKeyPath + '"' : ''}`;
      run(`rsync -avz -e ${quote(rsyncSsh)} ${quote(payrollLocal + path.sep)} ${remote}:${remotePath}/Payroll System/`);
    } else {
      run(`scp -r ${scpOpt} ${quote(payrollLocal)} ${remote}:${remotePath}/`);
    }
  } else {
    console.log('\n--- Skipping Payroll System (folder not found) ---');
  }
}

// 4. On server: install (only when backend changed) and restart
if (frontendOnly) {
  console.log('\n--- On server: PM2 restart only ---');
  const remoteCmd = '(pm2 restart spectrum-outfitters 2>/dev/null || pm2 restart spectrum-calendar 2>/dev/null || true) && pm2 save 2>/dev/null || true';
  run('ssh ' + (sshOpt ? sshOpt + ' ' : '') + remote + ' ' + quote(remoteCmd));
} else {
  console.log('\n--- On server: npm install (backend), PM2 restart ---');
  const remoteCmd = 'cd ' + remotePath + '/backend && npm install --production && (pm2 restart spectrum-outfitters 2>/dev/null || pm2 restart spectrum-calendar 2>/dev/null || true) && pm2 save';
  run('ssh ' + (sshOpt ? sshOpt + ' ' : '') + remote + ' ' + quote(remoteCmd));
}

console.log('\n--- Deploy done. Test: http://' + host + ' ---');
if (backendOnly) console.log('(Backend-only deploy)');
if (frontendOnly) console.log('(Frontend-only deploy)');

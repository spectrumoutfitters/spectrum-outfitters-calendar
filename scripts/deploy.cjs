const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '..');
const configPath = path.join(scriptDir, 'deploy.config.json');

if (!fs.existsSync(configPath)) {
  console.error('Missing scripts/deploy.config.json. Copy from deploy.config.example.json and set host, user, path.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { host, user, path: remotePath, sshKeyPath } = config;
const remote = `${user}@${host}`;
const sshOpt = sshKeyPath ? `-i "${sshKeyPath}"` : '';

function quote(p) {
  return `"${String(p).replace(/"/g, '\\"')}"`;
}

function run(cmd, opts = {}) {
  console.log('>', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: opts.cwd || projectRoot, ...opts });
}

// 0. Ensure remote directories exist (including Payroll System so backend can serve it)
console.log('\n--- Ensuring server directories exist ---');
run('ssh ' + (sshOpt ? sshOpt + ' ' : '') + remote + ' "mkdir -p ' + remotePath + '/backend ' + remotePath + '/frontend \'' + remotePath + '/Payroll System\'"');

// 1. Build frontend for subdomain root (login.spectrumoutfitters.com with no /login path)
console.log('\n--- Building frontend ---');
const buildEnv = { ...process.env, VITE_BASE_PATH: '' };
run('npm run build', { cwd: path.join(projectRoot, 'frontend'), env: buildEnv });

const be = path.join(projectRoot, 'backend');
const feDist = path.join(projectRoot, 'frontend', 'dist');
if (!fs.existsSync(feDist)) {
  console.error('frontend/dist not found after build.');
  process.exit(1);
}

// 2. Upload backend (no node_modules, no .env)
console.log('\n--- Uploading backend ---');
const scpOpt = sshKeyPath ? `-i ${quote(sshKeyPath)}` : '';
run(`scp ${scpOpt} ${quote(path.join(be, 'server.js'))} ${quote(path.join(be, 'package.json'))} ${quote(path.join(be, 'package-lock.json'))} ${remote}:${remotePath}/backend/`);
if (fs.existsSync(path.join(be, 'reset_password.js')))
  run(`scp ${scpOpt} ${quote(path.join(be, 'reset_password.js'))} ${remote}:${remotePath}/backend/`);
for (const dir of ['database', 'routes', 'middleware', 'utils']) {
  const full = path.join(be, dir);
  if (fs.existsSync(full))
    run(`scp -r ${scpOpt} ${quote(full)} ${remote}:${remotePath}/backend/`);
}

// 3. Upload frontend dist
console.log('\n--- Uploading frontend/dist ---');
run(`scp -r ${scpOpt} ${quote(feDist)} ${remote}:${remotePath}/frontend/`);

// 3b. Optional: upload Payroll System if it exists (sibling folder or project/Payroll System)
const payrollLocal = fs.existsSync(path.join(projectRoot, 'Payroll System'))
  ? path.join(projectRoot, 'Payroll System')
  : path.join(projectRoot, '..', 'Payroll System');
if (fs.existsSync(payrollLocal)) {
  console.log('\n--- Uploading Payroll System ---');
  run(`scp -r ${scpOpt} ${quote(payrollLocal)} ${remote}:${remotePath}/`);
} else {
  console.log('\n--- Skipping Payroll System (folder not found at project/Payroll System or ../Payroll System) ---');
}

// 4. On server: npm install, init-db, pm2
console.log('\n--- On server: install, init-db, PM2 ---');
const remoteCmd = 'cd ' + remotePath + '/backend && npm install --production && npm run init-db && (pm2 restart spectrum-outfitters 2>/dev/null || pm2 start server.js --name spectrum-outfitters) && pm2 save';
const sshCmd = 'ssh ' + (sshOpt ? sshOpt + ' ' : '') + remote + ' ' + quote(remoteCmd);
run(sshCmd);

console.log('\n--- Deploy done. Test: http://' + host + '/login ---');
console.log('If you have not set up nginx yet, run the nginx steps in docs/GO_LIVE_CHECKLIST.md Part 4 on the server.');

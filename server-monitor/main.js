const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn, exec } = require('child_process');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const DEFAULT_CONFIG = {
  apiBaseUrl: '',
  apiToken: '',
  projectPath: '',
  serverHost: '165.245.137.192',
  serverUser: 'root',
  serverAppPath: '/opt/spectrum-calendar',
  sshKeyPath: '',
  darkMode: false
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function fetchUrl(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      headers: { 'User-Agent': 'SpectrumServerMonitor/1.0' },
      timeout: 15000
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const req = lib.get(url, opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 400) {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
  });
}

let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const opts = {
    width: 1000,
    height: 720,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  if (fs.existsSync(iconPath)) opts.icon = iconPath;
  mainWindow = new BrowserWindow(opts);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (_e, config) => {
  const current = loadConfig();
  const merged = { ...current, ...config };
  saveConfig(merged);
  return loadConfig();
});

ipcMain.handle('api:fetch', async (_e, endpoint, token) => {
  const cfg = loadConfig();
  const base = (cfg.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Set API Base URL in Settings first.');
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
  return fetchUrl(url, token || cfg.apiToken);
});

// Open Cursor with the project folder
ipcMain.handle('cursor:open', async () => {
  const cfg = loadConfig();
  const projectPath = (cfg.projectPath || '').trim();
  if (!projectPath) throw new Error('Set Local project path in Settings first.');
  if (!fs.existsSync(projectPath)) throw new Error('Project path does not exist: ' + projectPath);
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32' ? 'cursor' : 'cursor';
    const args = projectPath ? [projectPath] : [];
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', shell: true });
    child.unref();
    child.on('error', (err) => reject(new Error('Failed to open Cursor: ' + (err.message || err))));
    setTimeout(() => resolve({ ok: true }), 500);
  });
});

// Push local code to server: optional git push, then SSH to server and run deploy
ipcMain.handle('deploy:toServer', async () => {
  const cfg = loadConfig();
  const projectPath = (cfg.projectPath || '').trim();
  const host = (cfg.serverHost || '').trim();
  const user = (cfg.serverUser || 'root').trim();
  const appPath = (cfg.serverAppPath || '').trim();
  const keyPath = (cfg.sshKeyPath || '').trim();

  if (!projectPath || !fs.existsSync(projectPath)) throw new Error('Set a valid Local project path in Settings.');
  if (!host || !user) throw new Error('Set Server host and user in Settings.');

  const run = (command, opts = { cwd: projectPath, shell: true }) =>
    new Promise((resolve, reject) => {
      exec(command, { ...opts, timeout: 120000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || stdout || err.message));
        else resolve({ stdout: String(stdout), stderr: String(stderr) });
      });
    });

  // 1) Optional: git push from local (so server can pull)
  try {
    await run('git push origin main');
  } catch (e) {
    try {
      await run('git push origin master');
    } catch (e2) {
      // No remote or not set up — continue to SSH deploy; server might already have code
        }
  }

  // 2) SSH to server and pull + build + restart
  const sshCmd = keyPath
    ? `ssh -o StrictHostKeyChecking=no -i "${keyPath}" ${user}@${host}`
    : `ssh -o StrictHostKeyChecking=no ${user}@${host}`;
  const remoteCmd = [
    `cd ${appPath}`,
    'git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true',
    'cd backend && npm install --omit=dev',
    'cd ../frontend && npm install && npm run build',
    'systemctl restart spectrum-calendar 2>/dev/null || pm2 restart spectrum-calendar 2>/dev/null || true',
    'echo Deploy done'
  ].join(' && ');
  const fullCmd = `${sshCmd} "${remoteCmd.replace(/"/g, '\\"')}"`;
  const result = await run(fullCmd, { cwd: undefined, shell: true });
  return { ok: true, stdout: result.stdout, stderr: result.stderr };
});

// Open a new terminal window with SSH connected (quick access to server)
ipcMain.handle('ssh:openTerminal', async () => {
  const cfg = loadConfig();
  const host = (cfg.serverHost || '').trim();
  const user = (cfg.serverUser || 'root').trim();
  const keyPath = (cfg.sshKeyPath || '').trim();
  if (!host || !user) throw new Error('Set Server host and user in Settings.');
  const sshCmd = keyPath ? `ssh -i "${keyPath}" ${user}@${host}` : `ssh ${user}@${host}`;
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', 'cmd', '/k', sshCmd], { detached: true, stdio: 'ignore' });
  } else if (process.platform === 'darwin') {
    spawn('osascript', ['-e', `tell application "Terminal" to do script ${JSON.stringify(sshCmd)}`], { detached: true, stdio: 'ignore' });
  } else {
    spawn('gnome-terminal', ['--', 'bash', '-c', sshCmd + '; exec bash'], { detached: true, stdio: 'ignore' }).on('error', () => {
      spawn('xterm', ['-e', sshCmd], { detached: true, stdio: 'ignore' });
    });
  }
  return { ok: true };
});

// Run npm run deploy in project (opens a new terminal so you see output)
ipcMain.handle('deploy:npmRunDeploy', async () => {
  const cfg = loadConfig();
  const projectPath = (cfg.projectPath || '').trim();
  if (!projectPath || !fs.existsSync(projectPath)) throw new Error('Set a valid Local project path in Settings.');
  if (process.platform === 'win32') {
    // Use start /d "path" so the new cmd starts in project root (avoids quoting issues with spaces)
    spawn('cmd', ['/c', 'start', '"Deploy"', '/d', projectPath, 'cmd', '/k', 'npm run deploy'], {
      detached: true,
      stdio: 'ignore',
      shell: false
    }).unref();
    return { ok: true };
  }
  const child = spawn('npm', ['run', 'deploy'], { cwd: projectPath, detached: true, stdio: 'inherit', shell: true });
  child.unref();
  return { ok: true };
});

// Run scripts/deploy.cjs with --backend-only or --frontend-only (incremental deploy from UI)
function runDeployScript(projectPath, flag) {
  const deployScript = path.join(projectPath, 'scripts', 'deploy.cjs');
  const configPath = path.join(projectPath, 'scripts', 'deploy.config.json');
  if (!fs.existsSync(deployScript)) throw new Error('scripts/deploy.cjs not found. Use "Deploy to server" or run deploy from the project in a terminal.');
  if (!fs.existsSync(configPath)) throw new Error('scripts/deploy.config.json not found. Copy from deploy.config.example.json and set host, user, path.');
  // Quote path for shell (Windows cmd: "path", escape " as ""; Unix: 'path')
  function quotePath(p) {
    const s = String(p);
    if (process.platform === 'win32') return '"' + s.replace(/"/g, '""') + '"';
    return "'" + s.replace(/'/g, "'\\''") + "'";
  }
  const cmd = 'node ' + quotePath(deployScript) + ' ' + flag;
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: projectPath, shell: true, timeout: 120000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = String(stderr || stdout).trim();
      if (err) reject(new Error(out || err.message || 'Deploy failed.'));
      else resolve({ ok: true, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

ipcMain.handle('deploy:backendOnly', async () => {
  const cfg = loadConfig();
  const projectPath = (cfg.projectPath || '').trim();
  if (!projectPath || !fs.existsSync(projectPath)) throw new Error('Set a valid Local project path in Settings.');
  return runDeployScript(projectPath, '--backend-only');
});

ipcMain.handle('deploy:frontendOnly', async () => {
  const cfg = loadConfig();
  const projectPath = (cfg.projectPath || '').trim();
  if (!projectPath || !fs.existsSync(projectPath)) throw new Error('Set a valid Local project path in Settings.');
  return runDeployScript(projectPath, '--frontend-only');
});

ipcMain.handle('deploy:fullForce', async () => {
  const cfg = loadConfig();
  const projectPath = (cfg.projectPath || '').trim();
  if (!projectPath || !fs.existsSync(projectPath)) throw new Error('Set a valid Local project path in Settings.');
  return runDeployScript(projectPath, '--force');
});

ipcMain.handle('dialog:openFolder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { filePaths } = await dialog.showOpenDialog(win || null, { properties: ['openDirectory'] });
  return filePaths[0] || null;
});

ipcMain.handle('dialog:openFile', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { filePaths } = await dialog.showOpenDialog(win || null, { properties: ['openFile'] });
  return filePaths[0] || null;
});

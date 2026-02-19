import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

let backendProcess = null;
let frontendProcess = null;
let launcherServer = null;
let isRunning = false;
let networkIP = null;

const isWindows = process.platform === 'win32';
const PORT = 3001; // Launcher web interface port

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

function checkDependencies() {
  log('Checking dependencies...');
  
  if (!existsSync(join(ROOT_DIR, 'backend', 'node_modules'))) {
    log('Installing backend dependencies...');
    execSync('npm install', { cwd: join(ROOT_DIR, 'backend'), stdio: 'inherit' });
  }
  
  if (!existsSync(join(ROOT_DIR, 'frontend', 'node_modules'))) {
    log('Installing frontend dependencies...');
    execSync('npm install', { cwd: join(ROOT_DIR, 'frontend'), stdio: 'inherit' });
  }
  
  // Check database
  if (!existsSync(join(ROOT_DIR, 'backend', 'database', 'shop_tasks.db'))) {
    log('Initializing database...');
    execSync('npm run init-db', { cwd: join(ROOT_DIR, 'backend'), stdio: 'inherit' });
  }
  
  // Run migrations
  try {
    execSync('npm run migrate-messages', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }

  try {
    execSync('npm run migrate-inventory', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }

  try {
    execSync('npm run migrate-inventory-weight', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }

  try {
    execSync('npm run migrate-inventory-viscosity', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }

  try {
    execSync('npm run migrate-inventory-refill', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }

  try {
    execSync('npm run migrate-inventory-image', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }

  try {
    execSync('npm run migrate-refill-order-details', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }

  try {
    execSync('npm run migrate-quantity-log-task-approved', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }

  try {
    execSync('npm run migrate-app-settings', { cwd: join(ROOT_DIR, 'backend'), stdio: 'ignore' });
  } catch (e) {
    // Migration may already be run, that's OK
  }
}

function startBackend() {
  if (backendProcess) {
    log('Backend already running');
    return;
  }
  
  log('Starting backend server...');
  const command = isWindows ? 'npm.cmd' : 'npm';
  
  backendProcess = spawn(command, ['run', 'dev'], {
    cwd: join(ROOT_DIR, 'backend'),
    stdio: 'pipe',
    shell: isWindows,
  });
  
  backendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Extract network IP from backend output
    const networkMatch = output.match(/Network:\s+http:\/\/([\d.]+):(\d+)/);
    if (networkMatch) {
      networkIP = networkMatch[1];
      const port = networkMatch[2];
      log('');
      log('═══════════════════════════════════════════════════════');
      log('🌐 NETWORK ACCESS INFORMATION');
      log('═══════════════════════════════════════════════════════');
      log(`📱 Access from other devices on the same WiFi:`);
      log(`   http://${networkIP}:${port}`);
      log('');
      log(`💻 Local access:`);
      log(`   http://localhost:${port}`);
      log('═══════════════════════════════════════════════════════');
      log('');
    }
    
    if (output.includes('Server running')) {
      log('Backend server started successfully');
    }
    
    // Also print backend output for debugging
    process.stdout.write(data);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend error: ${data}`);
  });
  
  backendProcess.on('exit', (code) => {
    log(`Backend exited with code ${code}`);
    backendProcess = null;
    isRunning = false;
    updateStatus();
  });
}

function startFrontend() {
  if (frontendProcess) {
    log('Frontend already running');
    return;
  }
  
  log('Starting frontend server...');
  const command = isWindows ? 'npm.cmd' : 'npm';
  
  frontendProcess = spawn(command, ['run', 'dev'], {
    cwd: join(ROOT_DIR, 'frontend'),
    stdio: 'pipe',
    shell: isWindows,
  });
  
  frontendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Local:') || output.includes('localhost')) {
      log('Frontend server started successfully');
      if (networkIP) {
        log('');
        log('═══════════════════════════════════════════════════════');
        log('✅ APPLICATION READY');
        log('═══════════════════════════════════════════════════════');
        log(`📱 Network Access: https://${networkIP}:5173`);
        log(`💻 Local Access:   https://localhost:5173`);
        log('');
        log('📷 On your phone: open the URL above, tap "Advanced" then "Proceed" to allow the dev certificate, then camera scanning will work.');
        log('═══════════════════════════════════════════════════════');
        log('');
      }
    }
    
    // Also print frontend output for debugging
    process.stdout.write(data);
  });
  
  frontendProcess.stderr.on('data', (data) => {
    console.error(`Frontend error: ${data}`);
  });
  
  frontendProcess.on('exit', (code) => {
    log(`Frontend exited with code ${code}`);
    frontendProcess = null;
    isRunning = false;
    updateStatus();
  });
}

function stopBackend() {
  if (backendProcess) {
    log('Stopping backend server...');
    backendProcess.kill();
    backendProcess = null;
  }
}

function stopFrontend() {
  if (frontendProcess) {
    log('Stopping frontend server...');
    frontendProcess.kill();
    frontendProcess = null;
  }
}

function stopAll() {
  stopBackend();
  stopFrontend();
  isRunning = false;
  updateStatus();
}

function startAll() {
  if (isRunning) {
    log('Application already running');
    return;
  }
  
  checkDependencies();
  isRunning = true;
  updateStatus();
  startBackend();
  
  setTimeout(() => {
    startFrontend();
    setTimeout(() => {
      if (isWindows) {
        execSync('start https://localhost:5173', { stdio: 'ignore' });
      } else if (process.platform === 'darwin') {
        execSync('open https://localhost:5173', { stdio: 'ignore' });
      } else {
        execSync('xdg-open https://localhost:5173', { stdio: 'ignore' });
      }
    }, 3000);
  }, 3000);
}

function updateStatus() {
  // This will be used by the web interface
}

function createHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spectrum Outfitters - Application Launcher</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .status {
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 30px;
            font-weight: 600;
            font-size: 16px;
        }
        .status.running {
            background: #d4edda;
            color: #155724;
        }
        .status.stopped {
            background: #f8d7da;
            color: #721c24;
        }
        .button {
            width: 100%;
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .button.start {
            background: #28a745;
            color: white;
        }
        .button.start:hover {
            background: #218838;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4);
        }
        .button.stop {
            background: #dc3545;
            color: white;
        }
        .button.stop:hover {
            background: #c82333;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(220, 53, 69, 0.4);
        }
        .button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        .links {
            margin-top: 30px;
            padding-top: 30px;
            border-top: 1px solid #eee;
        }
        .link {
            display: block;
            color: #667eea;
            text-decoration: none;
            margin: 10px 0;
            font-size: 14px;
        }
        .link:hover {
            text-decoration: underline;
        }
        .info {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            font-size: 12px;
            color: #666;
            line-height: 1.6;
        }
        .network-info {
            margin-top: 20px;
            padding: 15px;
            background: #e7f3ff;
            border: 2px solid #2196F3;
            border-radius: 10px;
            font-size: 13px;
            color: #1976D2;
        }
        .network-info strong {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .network-url {
            font-family: monospace;
            background: white;
            padding: 8px 12px;
            border-radius: 5px;
            margin: 5px 0;
            word-break: break-all;
            border: 1px solid #90CAF9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚗 Spectrum Outfitters</h1>
        <p class="subtitle">Application Launcher</p>
        
        <div id="status" class="status stopped">
            ⏹ Stopped
        </div>
        
        <button id="startBtn" class="button start" onclick="startApp()">
            ▶ Start Application
        </button>
        
        <button id="stopBtn" class="button stop" onclick="stopApp()" disabled>
            ⏹ Stop Application
        </button>
        
        <div class="links">
            <a href="https://localhost:5173" target="_blank" class="link" id="frontendLink" style="display:none;">
                🌐 Open Application
            </a>
            <a href="http://localhost:5000/api/health" target="_blank" class="link" id="backendLink" style="display:none;">
                🔧 Backend API Status
            </a>
        </div>
        
        <div class="info">
            <strong>Status:</strong><br>
            <span id="backendStatus">Backend: Stopped</span><br>
            <span id="frontendStatus">Frontend: Stopped</span>
        </div>
        
        <div id="networkInfo" class="network-info" style="display:none;">
            <strong>📱 Network Access:</strong>
            <div class="network-url" id="networkUrl">Loading...</div>
            <div style="margin-top: 8px; font-size: 11px;">
                Use this address on other devices connected to the same WiFi
            </div>
        </div>
    </div>
    
    <script>
        let statusInterval;
        
        function updateStatus() {
            fetch('/api/status')
                .then(res => res.json())
                .then(data => {
                    const statusDiv = document.getElementById('status');
                    const startBtn = document.getElementById('startBtn');
                    const stopBtn = document.getElementById('stopBtn');
                    const frontendLink = document.getElementById('frontendLink');
                    const backendLink = document.getElementById('backendLink');
                    const backendStatus = document.getElementById('backendStatus');
                    const frontendStatus = document.getElementById('frontendStatus');
                    const networkInfo = document.getElementById('networkInfo');
                    const networkUrl = document.getElementById('networkUrl');
                    
                    if (data.running) {
                        statusDiv.className = 'status running';
                        statusDiv.textContent = '▶ Running';
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                        frontendLink.style.display = 'block';
                        backendLink.style.display = 'block';
                        
                        // Show network info if available
                        if (data.networkIP) {
                            networkInfo.style.display = 'block';
                            networkUrl.textContent = 'https://' + data.networkIP + ':5173';
                        }
                    } else {
                        statusDiv.className = 'status stopped';
                        statusDiv.textContent = '⏹ Stopped';
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                        frontendLink.style.display = 'none';
                        backendLink.style.display = 'none';
                        networkInfo.style.display = 'none';
                    }
                    
                    backendStatus.textContent = 'Backend: ' + (data.backend ? 'Running' : 'Stopped');
                    frontendStatus.textContent = 'Frontend: ' + (data.frontend ? 'Running' : 'Stopped');
                })
                .catch(err => {
                    console.error('Status check failed:', err);
                });
        }
        
        function startApp() {
            fetch('/api/start', { method: 'POST' })
                .then(() => {
                    setTimeout(updateStatus, 2000);
                })
                .catch(err => {
                    alert('Failed to start: ' + err.message);
                });
        }
        
        function stopApp() {
            fetch('/api/stop', { method: 'POST' })
                .then(() => {
                    setTimeout(updateStatus, 1000);
                })
                .catch(err => {
                    alert('Failed to stop: ' + err.message);
                });
        }
        
        // Check status every 2 seconds
        statusInterval = setInterval(updateStatus, 2000);
        updateStatus();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            clearInterval(statusInterval);
        });
    </script>
</body>
</html>
  `;
}

function startLauncherServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(createHTML());
    } else if (url.pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        running: isRunning,
        backend: backendProcess !== null,
        frontend: frontendProcess !== null
      }));
    } else if (url.pathname === '/api/start' && req.method === 'POST') {
      startAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } else if (url.pathname === '/api/stop' && req.method === 'POST') {
      stopAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log(`⚠️  Port ${PORT} is already in use. The launcher may already be running.`);
      log(`💡 Try opening http://localhost:${PORT} in your browser`);
      log(`💡 Or close the existing launcher and try again`);
      log(`💡 To kill the existing process, run: netstat -ano | findstr :${PORT}`);
      process.exit(1);
    } else {
      log(`❌ Launcher server error: ${err.message}`);
      process.exit(1);
    }
  });
  
  server.listen(PORT, () => {
    log(`✅ Launcher web interface running on http://localhost:${PORT}`);
    if (isWindows) {
      try {
        execSync(`start http://localhost:${PORT}`, { stdio: 'ignore' });
      } catch (e) {
        // Browser may not open, that's OK
      }
    } else if (process.platform === 'darwin') {
      try {
        execSync(`open http://localhost:${PORT}`, { stdio: 'ignore' });
      } catch (e) {
        // Browser may not open, that's OK
      }
    } else {
      try {
        execSync(`xdg-open http://localhost:${PORT}`, { stdio: 'ignore' });
      } catch (e) {
        // Browser may not open, that's OK
      }
    }
  });
  
  launcherServer = server;
}

// Handle cleanup
process.on('SIGINT', () => {
  log('Shutting down...');
  stopAll();
  if (launcherServer) {
    launcherServer.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down...');
  stopAll();
  if (launcherServer) {
    launcherServer.close();
  }
  process.exit(0);
});

// Start launcher server
log('Starting Spectrum Outfitters Launcher...');
startLauncherServer();


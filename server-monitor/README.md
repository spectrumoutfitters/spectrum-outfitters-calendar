# Spectrum Server Monitor

Desktop app (Windows) that runs **only on your PC** and:

- **Watches the server** — health, active sessions, recent login events (refreshes every 20s)
- **Open Cursor** — opens the project folder in Cursor so you can edit code
- **Push to server** — runs `git push` from your PC, then SSHs to the server (e.g. `root@165.245.137.192`) to pull, build frontend, and restart the app

No browser needed.

## How to run

```bash
cd server-monitor
npm install
npm start
```

## Settings

Click **Settings** and configure:

**Connection**
- **API Base URL**: `https://login.spectrumoutfitters.com/api`
- **Admin token**: From the web app, DevTools → Application → Local Storage → copy `token`

**Local project & deploy**
- **Local project path**: Your Calendar project folder (e.g. `C:\Users\you\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar`) — used for Open Cursor and `git push`
- **Server host**: `165.245.137.192`
- **Server user**: `root`
- **Server app path**: Folder on the server where the app lives (e.g. `/opt/spectrum-calendar`)
- **SSH key path**: Optional; leave blank to use your default SSH key (e.g. `C:\Users\you\.ssh\id_rsa`)

Save, then use **Open Cursor** and **Push to server** from the Dev tools section.

## First-time server setup

Before **Push to server** works, the server must have the app and git:

1. SSH in: `ssh root@165.245.137.192`
2. Clone the repo (after you’ve pushed to GitHub from your PC):
   ```bash
   git clone https://github.com/YOUR_USER/YOUR_REPO.git /opt/spectrum-calendar
   cd /opt/spectrum-calendar
   cd backend && npm install
   cd ../frontend && npm install && npm run build
   ```
3. Start the backend (e.g. `pm2 start backend/server.js --name spectrum-calendar` or set up systemd). Then in the monitor, set **Server app path** to `/opt/spectrum-calendar` and use **Push to server** for future deploys.

## Build installer (optional)

From `server-monitor`: `npm run build`. Installer is in `dist/`.

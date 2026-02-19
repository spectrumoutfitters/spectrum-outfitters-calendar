# Spectrum Server Monitor

Desktop app (Windows) that runs **only on your PC** and watches your Spectrum Outfitters server. It shows:

- **Server health** (online/offline)
- **Active sessions** — who is logged in, IP, device, last seen
- **Recent login events** — time, user, success/fail, IP, location, on-prem score

No browser needed. Data refreshes every 20 seconds.

## How to run

1. Install dependencies and start the app:
   ```bash
   cd server-monitor
   npm install
   npm start
   ```
   Or from the project root: `npm run monitor`

2. First time: click **Settings** and set:
   - **API Base URL**: `https://login.spectrumoutfitters.com/api` (or your backend URL)
   - **Admin token**: After logging into the web app in a browser, open DevTools (F12) → Application → Local Storage → copy the value of `token` (your JWT). Paste it here.
   Click **Save**.

3. The dashboard will show health, stats, active sessions, and login events. Use **Refresh now** anytime.

## Build installer (optional)

From `server-monitor` folder: `npm run build`. The installer will be in `dist/`.

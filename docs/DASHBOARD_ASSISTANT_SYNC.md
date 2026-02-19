# Dashboard Assistant — sync and download link

The **Spectrum Outfitters Calendar** backend now hosts the Dashboard Assistant sync API so your computer acts as the server. When you push updates from the Dashboard Assistant, everyone who has the app and the sync URL set will stay in sync.

## API (already added)

- **GET** `http://YOUR_SERVER:5000/api/dashboard-config` — returns the last pushed config (items, category order, Spectrum server). Used by the app on startup and when users click "Pull update".
- **POST** `http://YOUR_SERVER:5000/api/dashboard-config` — saves the config (called when you click "Push update" in Dashboard Assistant). Stored in `backend/data/dashboard-config.json`.

Replace `YOUR_SERVER` with:
- **Same machine:** `localhost` (e.g. `http://localhost:5000/api/dashboard-config`)
- **Network (your PC as server):** your computer’s IP (e.g. `http://192.168.1.100:5000/api/dashboard-config`)
- **Deployed site:** your domain (e.g. `https://spectrumoutfitters.com/api/dashboard-config` if the Calendar backend is deployed there)

## Sync URL in the app

- **Your machine (admin):** In Dashboard Assistant → Settings → set **Sync server URL** to e.g. `http://localhost:5000/api/dashboard-config` (or your public URL if you’re not on the same PC). Save, then use **Push update** after you change items or credentials.
- **Other users:** Set **Sync server URL** to the **same** URL (so it points to your Calendar server). Save. The app will **auto-pull on every startup**, so they’re always in sync with your last push until you push again.

## Download link on the calendar page

Put a **Download Dashboard Assistant** link on the calendar webpage so users can get the app. The link should point to the built installer (e.g. a `.exe` or installer you host).

1. **Build the app** (from the Dashboard Assistant project):
   ```bash
   cd "Applications/DashBoard Assistant"
   npm install
   npx electron-builder --win
   ```
   Output is usually in `dist/` (e.g. `Dashboard Assistant Setup 0.1.0.exe`).

2. **Host the file** somewhere the calendar can link to it:
   - Same Calendar server: e.g. put the `.exe` in a folder served by Express (e.g. `backend/downloads/DashboardAssistant-Setup.exe`) and add a static route if needed, or use a cloud link (OneDrive, Google Drive, your website).
   - Or use your Spectrum Outfitters website.

3. **Download link in the calendar UI**  
   The sidebar already has a **Download Dashboard Assistant** link at the bottom. Point it to your hosted file by setting this in the Calendar **frontend** `.env`:

   ```
   VITE_DASHBOARD_ASSISTANT_DOWNLOAD_URL=https://your-site.com/downloads/DashboardAssistant-Setup.exe
   ```

   (Use your real URL where the `.exe` is hosted. If this variable is not set, the link goes to `#` until you set it.)

4. **First run for users:** After they install, they open Dashboard Assistant → Settings → set **Sync server URL** to your Calendar server URL (e.g. `http://YOUR_IP:5000/api/dashboard-config`) → Save. From then on, every time they open the app it will auto-pull your latest pushed config.

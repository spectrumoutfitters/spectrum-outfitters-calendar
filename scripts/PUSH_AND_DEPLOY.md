# Push code to the server

Your latest code (security API, active sessions fix, server monitor) is **committed locally**. To get it on the server you can do one of the following.

---

## Option A: Push to GitHub, then deploy on the server

1. **Create a repo** on GitHub (e.g. `spectrum-outfitters-calendar`), **private** is fine.

2. **Add the remote and push** (replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub details):
   ```bash
   cd "c:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

3. **On the server** (SSH in, e.g. `ssh root@165.245.137.192`):
   - If the app is already in a folder (e.g. `/opt/spectrum-calendar`):
     ```bash
     cd /opt/spectrum-calendar
     git pull origin main
     cd backend && npm install
     cd ../frontend && npm install && npm run build
     # Restart the Node process (e.g. systemctl restart spectrum-calendar or pm2 restart ...)
     ```
   - Or clone once then pull:
     ```bash
     git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /opt/spectrum-calendar
     cd /opt/spectrum-calendar
     # ... same install/build/restart as above
     ```

---

## Option B: Copy files to the server (no GitHub)

1. Copy the project folder to the server (e.g. with FileZilla, WinSCP, or `scp`):
   - Copy at least: `backend/`, `frontend/`, `scripts/deploy.sh`
   - Exclude: `node_modules/`, `frontend/dist/`, `.env` files (keep env on server)

2. **On the server**:
   ```bash
   cd /path/to/spectrum-calendar/backend
   npm install
   cd ../frontend
   npm install
   npm run build
   # Restart your Node backend (systemctl, pm2, or however you run it)
   ```

---

## After deploy

- The **security API** (`/api/admin/security/active-sessions`, etc.) will be available.
- **Spectrum Server Monitor** will show active sessions once the updated backend is running.
- If you use **GitHub Actions** (`.github/workflows/deploy.yml`), add repo secrets `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `APP_DIR` and push to `main` to deploy automatically.

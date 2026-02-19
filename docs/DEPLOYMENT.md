# Deploying Spectrum Outfitters Online (spectrumoutfitters.com)

This guide covers putting the app online so it’s accessible from anywhere, using a **secret URL** on your domain (e.g. **spectrumoutfitters.com/login**), and your options for the **database** (keep it “local” on the server or use a private Google Sheet).

---

## 1. Secret URL (subpath)

The app supports a **base path** so it can live at a path like:

- **https://spectrumoutfitters.com/login**  
  (or `/calendar`, `/internal`, `/so-internal`, etc. — pick one and don’t share it publicly)

Only people who know the full URL can open the app. Your main site can stay at `https://spectrumoutfitters.com/` and the app stays “hidden” at the subpath.

**What’s already in the project:**

- **Frontend**: Build with `VITE_BASE_PATH=/login` (or your chosen path). All routes and assets use that path.
- **Backend**: Set `BASE_PATH=/login` in production so the Node server serves the SPA and assets under that path.

You only need to:

1. Choose a path (e.g. `/login`).
2. Set the same value in frontend build and backend env (see below).
3. Point your domain (or a reverse proxy) at the server that runs the app.

---

## 2. Database options

### Option A: Keep the database “local” (recommended)

- **Meaning of “local” here:** The database file lives only on the **server** where the app runs (your VPS or hosting machine). It is not a separate cloud DB service; only your app on that server can read/write it.
- **How:** Keep using **SQLite** as you do now. Deploy the full stack (Node + built React) on one server and set `DATABASE_PATH` to a path on that server (e.g. `./database/shop_tasks.db` or an absolute path). No code change required.
- **Backups:** Copy the `.db` file from the server regularly (e.g. cron + scp/rsync or your host’s backup feature).

This is the simplest and keeps data under your control on a single machine.

### Option B: Google Sheet as the database

- **“Password protected”:** Google Sheets don’t have a literal password. You make the sheet **private** (only your Google account or a service account can access it). The app then talks to the sheet via the **Google Sheets API** with credentials — so only your deployed app can read/write it. Users never see the sheet; they only use the app (which still has its own login).
- **What’s involved:**  
  - Create a **private** Google Sheet (share only with the service account email you use for the API).  
  - Add a **Google Sheets API** layer in the backend (new routes/services that read/write the sheet instead of SQLite for the data you want in the sheet).  
  - This is a larger change: your app currently uses SQLite everywhere; moving to Sheets means either replacing the DB layer or syncing between SQLite and Sheets.  
- **When it’s worth it:** If you specifically want data in a sheet (for your own viewing/editing in Drive) or you don’t want to manage a server filesystem at all, you can design a “Sheets-backed” mode. Otherwise, Option A is easier.

**Summary:** For “push it online but keep the database local,” Option A (SQLite on the same server) is the straightforward approach. Option B is possible but requires design and code for a Sheets-backed or hybrid setup and doesn’t add “password protection” in the classic sense — the sheet is just private and API-only.

---

## 3. Where to host (push it online)

You need one place that runs **Node** and serves the app (and, for Option A, holds the SQLite file).

### 3.1 VPS (e.g. DigitalOcean, Linode, Vultr, or your own server)

- **Good for:** Full control, SQLite on disk, secret path, your domain.
- **Steps (high level):**
  1. Create a VM (Ubuntu 22.04 or similar).
  2. Install Node.js (v18+), clone or upload your project.
  3. Set env vars (see Section 4).
  4. Build frontend with base path, run backend with `NODE_ENV=production`.
  5. Use **PM2** or **systemd** to keep the Node process running.
  6. Put **nginx** (or Caddy) in front: point **spectrumoutfitters.com** (or a subdomain) to this server; proxy `/api`, `/socket.io`, `/login` (and static under it) to Node, or serve Node directly on a port and proxy the whole site.

### 3.2 PaaS (Railway, Render, Fly.io, etc.)

- **Good for:** Less server admin; some support persistent disk (for SQLite).
- **Check:** Whether the plan includes **persistent storage** so the SQLite file isn’t wiped on restart. If not, you’d need to switch to their Postgres/DB or use Option B (Sheets).
- **Steps:** Connect repo, set env vars, set build command to build frontend with `VITE_BASE_PATH=/login`, then start the Node server. Set the same `BASE_PATH` in the backend. Point your domain (e.g. spectrumoutfitters.com) to the PaaS URL, or use a custom subpath if the platform supports it.

### 3.3 Your current machine (home/office) + port forward

- **Good for:** “DB stays on my PC.”
- **Reality:** You open a port (e.g. 443 or 80) on your router to this PC, use dynamic DNS (e.g. No-IP, DuckDNS) so spectrumoutfitters.com (or a subdomain) points to your IP. The app runs at e.g. `http://your-public-ip:5000` and you put nginx (or a simple reverse proxy) in front if you want HTTPS and the secret path.
- **Downsides:** PC must stay on and connected; home IP changes unless you have static IP; you’re responsible for security and HTTPS.

---

## 4. Env and build (secret path + production)

Use the **same** path value for frontend and backend (e.g. `/login`).

### 4.1 Frontend (build time)

Create or edit `frontend/.env.production`:

```env
VITE_BASE_PATH=/login
```

If your API is on the same origin (same domain/port), you don’t need `VITE_API_URL`. If the API is on another origin (e.g. different subdomain or port), set:

```env
VITE_API_URL=https://spectrumoutfitters.com/api
```

Then build:

```bash
cd frontend
npm run build
```

Assets and routes will be under `/login/`.

### 4.2 Backend (runtime)

In `backend/.env` (or your host’s env config), set:

```env
NODE_ENV=production
BASE_PATH=/login
DATABASE_PATH=./database/shop_tasks.db
# ... rest of your existing vars (JWT_SECRET, etc.)
```

So the backend serves the SPA and static files at `https://your-domain/login` and `https://your-domain/login/*`.

### 4.3 Same path everywhere

- Frontend `VITE_BASE_PATH` = Backend `BASE_PATH` = path you use in nginx/proxy (if any).
- Example: **spectrumoutfitters.com/login** → app; **spectrumoutfitters.com/login/api** → backend API if you put API under the same path; more commonly **spectrumoutfitters.com/api** → backend and **spectrumoutfitters.com/login** → frontend (see next section).

---

## 5. Reverse proxy (nginx) when using a secret path

If your main site (e.g. spectrumoutfitters.com) is served by **nginx** and the Spectrum Outfitters app runs on the same server (e.g. Node on port 5000), you can do:

- **spectrumoutfitters.com/** → main site (e.g. WordPress or static).
- **spectrumoutfitters.com/login** → Node (SPA + static assets).
- **spectrumoutfitters.com/api** → Node (API).
- **spectrumoutfitters.com/socket.io** → Node (WebSockets).

Example nginx snippet:

```nginx
# API and socket (no path prefix)
location /api {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location /socket.io {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
# App at secret path (full path forwarded to Node; Node has BASE_PATH=/login)
location /login {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

With this, the app is only reachable at **https://spectrumoutfitters.com/login** (and you can keep that URL private).

---

## 6. Quick checklist to “push it online” with a secret link

1. **Choose a path** (e.g. `/login`).
2. **Set `VITE_BASE_PATH=/login`** in `frontend/.env.production`, then `npm run build` in `frontend`.
3. **Set `BASE_PATH=/login` and `NODE_ENV=production`** (and `DATABASE_PATH` if needed) in `backend/.env` on the server.
4. **Deploy** the built `frontend/dist` and the backend (and run migrations if needed) to a VPS or PaaS.
5. **Point spectrumoutfitters.com** to that server (A/CNAME or reverse proxy as above).
6. **Keep the database “local”** by using SQLite on that same server (Option A); back up the `.db` file regularly.

After that, only people with the full URL (e.g. **https://spectrumoutfitters.com/login**) can open the app, and the database stays on your server (or, with extra work, in a private Google Sheet as in Option B).

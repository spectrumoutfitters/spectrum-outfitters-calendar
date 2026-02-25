# Spectrum Outfitters — Go Live Checklist

Use this list from top to bottom. Check off each step when done. Your VPS IP: **165.245.137.192**

---

## Part 1: Server setup (SSH into your VPS)

**How to SSH in:** Open PowerShell on your PC and run:
```powershell
ssh root@165.245.137.192
```
Enter your password when prompted. You should see a prompt like `root@ubuntu-s-1vcpu-1gb-35gb-intel-atl1-01:~#`

- [ ] **1.1** Update the server
  - Run: `apt update && apt upgrade -y`
  - Wait for it to finish (press Enter if it asks about services restarting).

- [ ] **1.2** Install Node.js 18
  - Run: `curl -fsSL https://deb.nodesource.com/setup_18.x | bash -`
  - When that finishes, run: `apt install -y nodejs`
  - Check: run `node -v` — you should see something like `v18.x.x`.
  - Check: run `npm -v` — you should see a version number.

- [ ] **1.3** Install PM2 (keeps your app running after you disconnect)
  - Run: `npm install -g pm2`

- [ ] **1.4** Install nginx (sends web traffic to your Node app)
  - Run: `apt install -y nginx`

- [ ] **1.5** Create the app folder (if you haven’t already)
  - Run: `mkdir -p /var/www/spectrum-outfitters`

- [ ] **1.6** Create backend folder and put .env there (you did this)
  - You already created `/var/www/spectrum-outfitters/backend/.env` and pasted the env content.
  - If not: `mkdir -p /var/www/spectrum-outfitters/backend` then `nano /var/www/spectrum-outfitters/backend/.env` and paste your env.

---

## Part 2: Get your app code onto the server

You need to copy your project’s **backend** (code only, no node_modules) and **frontend build** to the server. Pick **one** option.

### Option A: Use the deploy script (recommended)

- [ ] **2A.1** The deploy script is in your project. From your **PC**, open PowerShell and go to the project folder:
  ```powershell
  cd "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar"
  ```

- [ ] **2A.2** Create deploy config. Copy the example and edit it:
  - Copy `scripts/deploy.config.example.json` to `scripts/deploy.config.json`.
  - Open `scripts/deploy.config.json` and set:
    - `"host": "165.245.137.192"`
    - `"user": "root"`
    - `"path": "/var/www/spectrum-outfitters"`
  - Save the file.

- [ ] **2A.3** Create production frontend env (so the build uses the right path):
  - In folder `frontend`, create a file named `.env.production` (if it doesn’t exist).
  - Put this one line in it: `VITE_BASE_PATH=/login`
  - Save.

- [ ] **2A.4** Run the deploy from your PC:
  ```powershell
  npm run deploy
  ```
  - This builds the frontend and uploads backend + frontend/dist to the server.
  - If you get “scp not found” or “ssh not found”, make sure OpenSSH is installed on Windows (Settings → Apps → Optional features → OpenSSH Client).

- [ ] **2A.5** After deploy finishes, go back to your **SSH session** on the server and run the first-time setup (Part 3 below).

### Option B: Manual copy (one-time, if you don’t have the deploy script yet)

- [ ] **2B.1** On your **PC**, build the frontend:
  - Open PowerShell, go to project: `cd "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\frontend"`
  - Create `frontend/.env.production` with one line: `VITE_BASE_PATH=/login`
  - Run: `npm run build`
  - Wait until you see “built in …” and no errors.

- [ ] **2B.2** From your **PC** (PowerShell, project root), upload backend (excluding node_modules and .env):
  - **Important:** Do **not** copy your local database file (`*.db`) to the server. The server must keep its own database so live inventory and data are never overwritten by your local (e.g. low-inventory) data. Copy only code and migration scripts.
  - You can zip the backend without node_modules and .env and upload, or use scp. Example (adjust paths if needed):
  ```powershell
  # Database: copy only .js files (migrations, db.js, etc.), NOT .db — server keeps its own DB
  ssh root@165.245.137.192 "mkdir -p /var/www/spectrum-outfitters/backend/database"
  scp "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\backend\database\*.js" root@165.245.137.192:/var/www/spectrum-outfitters/backend/database/
  scp "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\backend\server.js" root@165.245.137.192:/var/www/spectrum-outfitters/backend/
  scp -r "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\backend\routes" root@165.245.137.192:/var/www/spectrum-outfitters/backend/
  scp -r "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\backend\middleware" root@165.245.137.192:/var/www/spectrum-outfitters/backend/
  scp -r "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\backend\utils" root@165.245.137.192:/var/www/spectrum-outfitters/backend/
  scp "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\backend\package.json" root@165.245.137.192:/var/www/spectrum-outfitters/backend/
  scp "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\backend\package-lock.json" root@165.245.137.192:/var/www/spectrum-outfitters/backend/
  scp "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\backend\reset_password.js" root@165.245.137.192:/var/www/spectrum-outfitters/backend/
  ```
  - Do **not** copy `backend/.env`, `backend/node_modules`, or any `backend/database/*.db` file. The server has its own .env and its own database file. If you have `backend/uploads` or `backend/downloads`, copy those too.

- [ ] **2B.3** Upload the frontend build:
  ```powershell
  scp -r "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\frontend\dist" root@165.245.137.192:/var/www/spectrum-outfitters/frontend/
  ```

- [ ] **2B.4** Then in **SSH on the server**, run Part 3 below.

---

## Part 3: First-time app setup on the server (SSH)

Do this **after** the app code is on the server (Part 2 done).

- [ ] **3.1** Go to backend and install dependencies
  - In SSH, run: `cd /var/www/spectrum-outfitters/backend`
  - Run: `npm install --production`
  - Wait for it to finish.

- [ ] **3.2** Create the database (tables)
  - Still in `backend`, run: `npm run init-db`
  - You should see a message about the database being initialized.

- [ ] **3.3** Start the app with PM2
  - Run: `pm2 start server.js --name spectrum-outfitters`
  - You should see a table with “spectrum-outfitters” and status “online”.

- [ ] **3.4** Make PM2 start on server reboot
  - Run: `pm2 save`
  - Run: `pm2 startup`
  - Copy and run the command it prints (it will look like `sudo env PATH=... pm2 startup systemd -u root --hp /root`).

- [ ] **3.5** Check the app is running
  - Run: `pm2 status` — “spectrum-outfitters” should be “online”.
  - Run: `pm2 logs spectrum-outfitters --lines 20` — you should see “Server running on port 5000” or similar. Press Ctrl+C to exit logs.

---

## Part 4: Nginx (so the world can reach your app)

Nginx will listen on port 80 and forward requests to your Node app.

- [ ] **4.1** Create an nginx config file on the server
  - Run: `nano /etc/nginx/sites-available/spectrum-outfitters`
  - Paste the block below (replace nothing; it uses your IP and /login):

  ```nginx
  server {
      listen 80;
      server_name 165.245.137.192;

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
          proxy_set_header Host $host;
      }

      location /login {
          proxy_pass http://127.0.0.1:5000;
          proxy_http_version 1.1;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      location /uploads {
          proxy_pass http://127.0.0.1:5000;
      }
      location /downloads {
          proxy_pass http://127.0.0.1:5000;
      }
      location /payroll-system {
          proxy_pass http://127.0.0.1:5000;
      }
  }
  ```

  - Save: Ctrl+O, Enter. Exit: Ctrl+X.

- [ ] **4.2** Enable the site
  - Run: `ln -sf /etc/nginx/sites-available/spectrum-outfitters /etc/nginx/sites-enabled/`

- [ ] **4.3** Remove default site (optional, avoids conflicts)
  - Run: `rm -f /etc/nginx/sites-enabled/default`

- [ ] **4.4** Test nginx config
  - Run: `nginx -t`
  - You should see “syntax is ok” and “test is successful”.

- [ ] **4.5** Restart nginx
  - Run: `systemctl restart nginx`

---

## Part 5: Test with the IP address

- [ ] **5.1** On your **PC**, open a browser and go to:
  - **http://165.245.137.192/login**
  - You should see your app (login page). If you see “Cannot GET /login” or a blank page, check PM2 logs: `pm2 logs spectrum-outfitters` and nginx: `systemctl status nginx`.

- [ ] **5.2** Create an admin user (if the DB is empty)
  - You may need to register or use a seed user. If your app has an init script or first-user flow, run or use that. Otherwise, check your app’s docs for “first user” or “admin signup”.

- [ ] **5.3** Log in and click around to confirm tasks, time, etc. work.

---

## Part 6: Use your domain (spectrumoutfitters.com)

Do this when you’re ready for the app to be at **https://spectrumoutfitters.com/login**.

- [ ] **6.1** Where is your domain managed?
  - (e.g. GoDaddy, Namecheap, Cloudflare, Google Domains.) Log in there.

- [ ] **6.2** Add an A record
  - Add a new **A** record:
    - **Name/Host:** `@` (or leave blank for root) for spectrumoutfitters.com, **or** a subdomain like `app` for app.spectrumoutfitters.com.
    - **Value/Points to:** `165.245.137.192`
    - **TTL:** 300 or 3600 (or default).
  - Save. DNS can take 5–60 minutes to update.

- [ ] **6.3** Update nginx to use the domain
  - On the server: `nano /etc/nginx/sites-available/spectrum-outfitters`
  - Change the line `server_name 165.245.137.192;` to:
    - `server_name spectrumoutfitters.com www.spectrumoutfitters.com;`  
    or, if you used a subdomain:
    - `server_name app.spectrumoutfitters.com;`
  - Save and exit. Run: `nginx -t` then `systemctl restart nginx`.

- [ ] **6.4** Test in browser
  - Open **http://spectrumoutfitters.com/login** (or http://app.spectrumoutfitters.com/login). It should show the app.

---

## Part 7: HTTPS (optional but recommended)

- [ ] **7.1** Install Certbot on the server
  - Run: `apt install -y certbot python3-certbot-nginx`

- [ ] **7.2** Get a certificate (only after Part 6 is done and DNS is pointing to the server)
  - Run: `certbot --nginx -d spectrumoutfitters.com -d www.spectrumoutfitters.com`
  - Or for a subdomain: `certbot --nginx -d app.spectrumoutfitters.com`
  - Follow the prompts (email, agree to terms). Certbot will change nginx config for HTTPS.

- [ ] **7.3** Test HTTPS
  - Open **https://spectrumoutfitters.com/login** — it should load with a padlock.

- [ ] **7.4** (Optional) In your app, if you have redirect or cookie settings, ensure they work with HTTPS. Usually no change needed if you use relative URLs.

---

## Part 8: Deploy script for future updates (if you used Option A in Part 2)

- [ ] **8.1** On your PC, `scripts/deploy.config.json` is already set (host, user, path).

- [ ] **8.2** When you change code and want the live site to update:
  - From project root: `npm run deploy`
  - Then on the server (SSH): `cd /var/www/spectrum-outfitters/backend && pm2 restart spectrum-outfitters`
  - Or the deploy script may restart PM2 for you; check the script’s last step.

---

## Quick reference

| What              | Where / Command |
|-------------------|------------------|
| SSH into server   | `ssh root@165.245.137.192` |
| App URL (by IP)   | http://165.245.137.192/login |
| App URL (by domain) | https://spectrumoutfitters.com/login (after Parts 6–7) |
| PM2 status        | `pm2 status` |
| PM2 logs          | `pm2 logs spectrum-outfitters` |
| Restart app       | `pm2 restart spectrum-outfitters` |
| Nginx restart     | `systemctl restart nginx` |

---

**You’re done when:** You can open https://spectrumoutfitters.com/login (or http://165.245.137.192/login), log in, and use the app. Check off each step as you go.

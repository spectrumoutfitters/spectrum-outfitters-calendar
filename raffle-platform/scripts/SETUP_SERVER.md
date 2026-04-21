# Server Setup — raffle.spectrumoutfitters.com

DigitalOcean Droplet: **165.245.137.192**  
Target URL: **https://raffle.spectrumoutfitters.com**

---

## 1. Add a DNS record in Bluehost

Your domain (spectrumoutfitters.com) DNS is managed in Bluehost.

1. Log in to Bluehost → **Domains** → **DNS Zone Editor**
2. Add an **A record**:
   - **Host / Name:** `raffle`
   - **Points to:** `165.245.137.192`
   - **TTL:** 300 (or Auto)
3. Save. DNS propagates in 5–30 minutes.

> After this, `raffle.spectrumoutfitters.com` will resolve to your Droplet.

---

## 2. SSH into your Droplet

```bash
ssh root@165.245.137.192
```

---

## 3. Clone the raffle platform onto the Droplet

```bash
# Clone just the raffle-platform subfolder using sparse checkout
git clone --filter=blob:none --sparse https://github.com/YOUR_REPO.git /opt/spectrum-raffle
cd /opt/spectrum-raffle
git sparse-checkout set raffle-platform
# Move files up if needed, or adjust APP_DIR in deploy.sh
```

> **Simpler alternative:** Copy the `raffle-platform/` folder to the server via SCP:
> ```bash
> # Run this from your local machine (Windows: use Git Bash or WSL)
> scp -r "Spectrum Outfitters Calendar/raffle-platform" root@165.245.137.192:/opt/spectrum-raffle
> ```

---

## 4. Create the env file on the server

```bash
nano /etc/spectrum-raffle.env
```

Paste this (replace with your real Apps Script URL):
```
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
NODE_ENV=production
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## 5. Install Node.js (if not already installed)

```bash
# Check first (raffle / Next.js 16 needs Node 20.9+)
node -v
npm -v

# If not installed or older than 20:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

---

## 6. Install PM2 (if not already installed)

```bash
npm install -g pm2
```

---

## 7. First-time deploy

```bash
cd /opt/spectrum-raffle/raffle-platform

# Copy env
cp /etc/spectrum-raffle.env .env.local

# Install dependencies & build
npm ci --include=dev
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs --env production
pm2 save

# Auto-start PM2 on reboot
pm2 startup
# Copy and run the command it prints
```

---

## 8. Set up Nginx

```bash
# Copy the nginx config
cp /opt/spectrum-raffle/raffle-platform/scripts/raffle.nginx /etc/nginx/sites-available/spectrum-raffle

# Enable it
ln -s /etc/nginx/sites-available/spectrum-raffle /etc/nginx/sites-enabled/spectrum-raffle

# Test config
nginx -t

# Reload nginx
systemctl reload nginx
```

At this point **http://raffle.spectrumoutfitters.com** should work.

---

## 9. Enable HTTPS (free SSL via Certbot)

```bash
# Install certbot if not already
apt install -y certbot python3-certbot-nginx

# Get a certificate (automatically updates your nginx config)
certbot --nginx -d raffle.spectrumoutfitters.com

# Follow the prompts — choose to redirect HTTP → HTTPS
```

After this, **https://raffle.spectrumoutfitters.com** is live with SSL. ✅

---

## 10. Test it

| URL | What you should see |
|-----|-------------------|
| `https://raffle.spectrumoutfitters.com` | Spectrum Outfitters homepage |
| `https://raffle.spectrumoutfitters.com/e/grand-opening` | Entry form |
| `https://raffle.spectrumoutfitters.com/admin/grand-opening` | Admin panel (enter your admin key) |
| `https://login.spectrumoutfitters.com/admin` (Grand Opening Day tab) | Staff setup & live raffle (admins see setup notes) |

---

## Future deploys

**Default:** pushing to `main` runs GitHub Actions, which rsyncs `raffle-platform/` to this droplet, runs `npm ci` / `npm run build`, restarts PM2 (`spectrum-raffle`), and **installs the nginx `spectrum-raffle` site the first time** (reverse proxy to port 3001). No manual step needed for that. Run **Certbot** once for HTTPS if you have not already.

If you use a **full git clone** at `/opt/spectrum-raffle`, you can also deploy from the server:

```bash
bash /opt/spectrum-raffle/raffle-platform/scripts/deploy.sh
```

Or from your local machine:

```bash
ssh root@165.245.137.192 'bash /opt/spectrum-raffle/raffle-platform/scripts/deploy.sh'
```

---

## PM2 quick reference

```bash
pm2 list                    # see all running processes
pm2 logs spectrum-raffle    # tail live logs
pm2 restart spectrum-raffle # restart after config changes
pm2 stop spectrum-raffle    # stop the app
```

---

## Ports in use on this Droplet

| Port | Service |
|------|---------|
| 5000 | Spectrum Outfitters Calendar (main app) |
| 3001 | Spectrum Raffle Platform (new) |
| 80/443 | Nginx (routes by subdomain) |

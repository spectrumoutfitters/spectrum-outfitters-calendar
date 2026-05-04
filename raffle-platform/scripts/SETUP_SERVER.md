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

**Alternative (recommended for CI):** In GitHub → **Settings → Secrets and variables → Actions**, add **`RAFFLE_APPS_SCRIPT_URL`** with the same Apps Script URL. Each deploy to `main` will write **`/etc/spectrum-raffle.env`** on the droplet automatically (no SSH edit needed).

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

---

## 11. Stripe paid tickets (production)

Paid tickets ride on the same Apps Script + Next app. Two pieces talk to each other:

1. **Stripe → Next.js webhook** — Stripe POSTs to `/api/raffle/webhook`. Next verifies the
   signature with `STRIPE_WEBHOOK_SECRET`.
2. **Next.js → Apps Script** — Next signs the payload with `RAFFLE_PAID_PURCHASE_SECRET`
   and POSTs `applyPaidTickets`. Apps Script verifies the HMAC using its
   `PAID_PURCHASE_SECRET` script property and writes paid-ticket rows to the sheet.

### 11a. Apps Script

Open the bound Apps Script (Extensions → Apps Script from the spreadsheet):

1. Replace `Code.gs` with the latest from this repo (`raffle-platform/google-apps-script/Code.gs`).
2. Project Settings → Script properties → add:
   - `PAID_PURCHASE_SECRET` = the value of `RAFFLE_PAID_PURCHASE_SECRET` in `.env.local`
     (it must match exactly).
3. Deploy → Manage deployments → edit the existing web app → New version → Deploy.
   The web app URL stays the same.

### 11b. Server env vars

Append to `/etc/spectrum-raffle.env` on the droplet (and to `raffle-platform/.env.local` locally):

```
STRIPE_SECRET_KEY=rk_live_… (or sk_live_…)
STRIPE_WEBHOOK_SECRET=whsec_… (filled in step 11c)
RAFFLE_PAID_PURCHASE_SECRET=<32-byte hex, same as Apps Script PAID_PURCHASE_SECRET>
NEXT_PUBLIC_RAFFLE_SITE_URL=https://raffle.spectrumoutfitters.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_… (optional; not used server-side)
```

Then on the droplet:

```bash
cp /etc/spectrum-raffle.env /opt/spectrum-raffle/raffle-platform/.env.local
pm2 restart spectrum-raffle
```

### 11c. Stripe dashboard

In Stripe → Developers → Webhooks → **Add endpoint**:

- Endpoint URL: `https://raffle.spectrumoutfitters.com/api/raffle/webhook`
- Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- Copy the signing secret it shows (`whsec_…`) and paste it into `STRIPE_WEBHOOK_SECRET`.

Restart the raffle app once more (`pm2 restart spectrum-raffle`).

### 11d. Turn on paid tickets per event

`https://raffle.spectrumoutfitters.com/admin/<slug>` → expand **Add or edit items** →
**Advanced settings → Paid tickets (Stripe)**:

- Tick **Enabled**.
- Set **Price per ticket** in cents (e.g. `500` = $5.00, Stripe minimum is ~50¢).
- Currency: `usd`.
- Max tickets per checkout: `100` (or whatever cap you want).
- Save changes — this will auto-add the new columns to the Events sheet on first save.

The Insights panel on the same page now shows live ticket counts, free-vs-paid split,
revenue per pool, and recent entries. It refreshes every 7 seconds.

### 11e. Confirm end-to-end (live)

1. Open the entry page and submit a real entry.
2. On the success state, click **Buy more tickets**, choose 1 ticket, complete the
   Stripe checkout with a real card.
3. Within ~30 seconds, refresh the admin page — the Insights tables should show that
   purchase under "Recent entries" with a Paid badge and the revenue should appear in
   the Pool breakdown row.
4. Open Stripe → Developers → Webhooks → click your endpoint → **Recent events** must
   show a `200 OK` for that event.

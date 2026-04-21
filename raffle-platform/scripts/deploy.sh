#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh  —  Raffle Platform deploy script
# Run on the DigitalOcean Droplet (165.245.137.192):
#
#   ssh root@165.245.137.192 'bash /opt/spectrum-raffle/scripts/deploy.sh'
#
# First-time setup: see scripts/SETUP_SERVER.md
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/spectrum-raffle}"
BRANCH="${BRANCH:-main}"
LOG_DIR="/var/log/spectrum-raffle"

echo "=== Deploying Spectrum Raffle Platform ==="
echo "Directory: $APP_DIR"
echo "Branch:    $BRANCH"
echo ""

# Ensure log directory exists
mkdir -p "$LOG_DIR"

cd "$APP_DIR"

echo ">>> Pulling latest code..."
git fetch origin
git reset --hard "origin/$BRANCH"

echo ">>> Installing dependencies..."
npm ci --include=dev

echo ">>> Writing .env.local from /etc/spectrum-raffle.env (if present)..."
if [ -f /etc/spectrum-raffle.env ]; then
  cp /etc/spectrum-raffle.env "$APP_DIR/.env.local"
  echo "    .env.local updated from /etc/spectrum-raffle.env"
else
  echo "    WARNING: /etc/spectrum-raffle.env not found."
  echo "    Make sure $APP_DIR/.env.local exists with APPS_SCRIPT_URL set."
fi

echo ">>> Building Next.js app..."
npm run build

echo ">>> Restarting PM2 process..."
if pm2 describe spectrum-raffle > /dev/null 2>&1; then
  pm2 restart spectrum-raffle
  echo "    PM2 process restarted."
else
  pm2 start ecosystem.config.cjs --env production
  pm2 save
  echo "    PM2 process started and saved."
fi

echo ""
echo "=== Deploy complete ==="
echo "Live at: https://raffle.spectrumoutfitters.com"

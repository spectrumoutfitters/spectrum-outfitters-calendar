#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh  —  Raffle Platform deploy script
# Run on the DigitalOcean Droplet (165.245.137.192):
#
#   ssh root@165.245.137.192 'bash /opt/spectrum-raffle/raffle-platform/scripts/deploy.sh'
#
# First-time setup: see scripts/SETUP_SERVER.md
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Repo root (contains .git when using a clone). Next app: raffle-platform/
REPO_DIR="${REPO_DIR:-/opt/spectrum-raffle}"
APP_DIR="${APP_DIR:-$REPO_DIR/raffle-platform}"
BRANCH="${BRANCH:-main}"
LOG_DIR="/var/log/spectrum-raffle"

echo "=== Deploying Spectrum Raffle Platform ==="
echo "Repo:      $REPO_DIR"
echo "App (cwd): $APP_DIR"
echo "Branch:    $BRANCH"
echo ""

# Ensure log directory exists
mkdir -p "$LOG_DIR"

echo ">>> Updating source..."
if [ -d "$REPO_DIR/.git" ]; then
  cd "$REPO_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
else
  echo "    No git repo at $REPO_DIR — skipping pull (files are updated by GitHub Actions rsync or manual copy)."
fi

echo ">>> Installing dependencies..."
cd "$APP_DIR"
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
  ( cd "$APP_DIR" && pm2 start ecosystem.config.cjs --env production )
  pm2 save
  echo "    PM2 process started and saved."
fi

echo ""
echo "=== Deploy complete ==="
echo "Live at: https://raffle.spectrumoutfitters.com"

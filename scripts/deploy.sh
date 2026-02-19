#!/bin/bash
# Deploy script — runs on the production server (165.245.137.192).
# Called by CI/CD or manually via: ssh root@165.245.137.192 'bash /opt/spectrum-calendar/scripts/deploy.sh'
#
# Assumptions:
#   - The repo is cloned at /opt/spectrum-calendar (adjust APP_DIR below)
#   - Node.js and npm are installed
#   - The backend runs as a systemd service named "spectrum-calendar"

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/spectrum-calendar}"
BRANCH="${BRANCH:-main}"

echo "=== Deploying Spectrum Outfitters Calendar ==="
echo "Directory: $APP_DIR"
echo "Branch:    $BRANCH"
echo ""

cd "$APP_DIR"

echo ">>> Pulling latest code..."
git fetch origin
git reset --hard "origin/$BRANCH"

echo ">>> Installing backend dependencies..."
cd "$APP_DIR/backend"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo ">>> Building frontend..."
cd "$APP_DIR/frontend"
npm ci 2>/dev/null || npm install
npm run build

echo ">>> Restarting backend service..."
if systemctl is-active --quiet spectrum-calendar 2>/dev/null; then
  systemctl restart spectrum-calendar
  echo "Service restarted."
elif command -v pm2 &>/dev/null; then
  pm2 restart spectrum-calendar 2>/dev/null || pm2 start "$APP_DIR/backend/server.js" --name spectrum-calendar
  echo "PM2 process restarted."
else
  echo "WARNING: No systemd service or pm2 found. Restart the backend manually."
fi

echo ""
echo "=== Deploy complete ==="

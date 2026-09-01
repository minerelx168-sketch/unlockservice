#!/usr/bin/env bash
#
# Deploys unlockservice on the target host. Safe to run repeatedly: the
# first run provisions, every run after that updates to the latest commit
# and restarts. Run it ON the server, as the app user (ubuntu), with sudo
# rights for the systemd and Caddy steps.
#
#   curl -fsSL https://raw.githubusercontent.com/minerelx168-sketch/unlockservice/main/deploy/deploy.sh | bash
#   # or, once the repo is on the box:
#   ~/apps/unlockservice/deploy/deploy.sh
#
set -euo pipefail

REPO="${REPO:-https://github.com/minerelx168-sketch/unlockservice.git}"
BRANCH="${BRANCH:-claude/website-design-patterns-5043ix}"
APP_DIR="${APP_DIR:-/home/ubuntu/apps/unlockservice}"
APP_USER="${APP_USER:-ubuntu}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# ---- prerequisites ----------------------------------------------------
say "Checking prerequisites"
command -v git >/dev/null || { echo "git is not installed"; exit 1; }
command -v node >/dev/null || { echo "node is not installed — Node 22 or newer is required"; exit 1; }
command -v npm >/dev/null || { echo "npm is not installed"; exit 1; }

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node $NODE_MAJOR is too old — install Node 22 or newer and re-run."
  exit 1
fi

# better-sqlite3 falls back to compiling from source when no prebuilt
# binary matches the platform, and then it needs a toolchain.
if ! command -v cc >/dev/null || ! command -v python3 >/dev/null; then
  say "Installing build tools for the native SQLite binding"
  sudo apt-get update -qq
  sudo apt-get install -y -qq build-essential python3
fi

# ---- source -----------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  say "Updating $APP_DIR to the latest $BRANCH"
  git -C "$APP_DIR" fetch --prune origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  say "Cloning into $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
say "Now at $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# The database lives inside the app directory and is not tracked, so a
# reset never touches it. Make sure it survives a first-time clone too.
mkdir -p "$APP_DIR/data"

# ---- build ------------------------------------------------------------
say "Installing dependencies"
npm ci

say "Building"
npm run build

# ---- environment ------------------------------------------------------
# The unit requires this file, so put the paused defaults in place before
# the first start. An existing file is never touched: it holds the
# operator's real values and this script must not overwrite them.
ENV_FILE="${ENV_FILE:-/etc/iunlockmobile.env}"
if [ -f "$ENV_FILE" ]; then
  say "Keeping the existing $ENV_FILE"
else
  say "Installing $ENV_FILE with paused defaults"
  sudo install -m 600 -o root -g root "$APP_DIR/deploy/iunlockmobile.env.example" "$ENV_FILE"
  echo "  Edit it before the service takes money: sudo nano $ENV_FILE"
fi

# ---- system units -----------------------------------------------------
say "Installing systemd units and the Caddy site"
sudo install -m 644 "$APP_DIR/deploy/unlockservice.service" /etc/systemd/system/unlockservice.service
if command -v caddy >/dev/null; then
  sudo install -m 644 "$APP_DIR/deploy/caddy.service" /etc/systemd/system/caddy.service
  sudo mkdir -p /etc/caddy
  sudo install -m 644 "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
else
  echo "Caddy is not installed — skipping the reverse proxy. See deploy/README.md."
fi

sudo systemctl daemon-reload
sudo systemctl enable --now unlockservice
sudo systemctl restart unlockservice
if command -v caddy >/dev/null; then
  sudo systemctl enable --now caddy
  sudo systemctl reload caddy || sudo systemctl restart caddy
fi

# ---- health -----------------------------------------------------------
say "Waiting for the app to answer"
for attempt in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$code" = "200" ]; then
    say "Live: the app and its database answered after ${attempt}s"
    exit 0
  fi
  sleep 1
done

echo "The app did not answer 200 within 30s. Recent logs:"
sudo journalctl -u unlockservice -n 40 --no-pager
exit 1

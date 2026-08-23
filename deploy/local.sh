#!/usr/bin/env bash
#
# Rehearses the production deploy on your own machine.
#
# It runs the same steps deploy.sh runs on the server — npm ci, a real
# production build, `next start` with NODE_ENV=production — but in the
# foreground, on its own database, with no sudo, no systemd and no Caddy.
# What you see at the URL it prints is what the server will serve.
#
#   ./deploy/local.sh                 # build and serve on :3000
#   ./deploy/local.sh --fresh --demo  # wipe the local data and seed an account
#   ./deploy/local.sh --port 4000
#
set -euo pipefail

PORT=3000
FRESH=0
DEMO=0

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:?--port needs a number}"; shift 2 ;;
    --fresh) FRESH=1; shift ;;
    --demo) DEMO=1; shift ;;
    -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
DB="$ROOT/data/local.db"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

command -v node >/dev/null || { echo "node is not installed"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || { echo "Node $NODE_MAJOR is too old — 22 or newer, please."; exit 1; }

if [ "$FRESH" = "1" ]; then
  say "Clearing the local database"
  rm -f "$DB" "$DB-wal" "$DB-shm"
fi

say "Installing dependencies (npm ci, exactly as the server does)"
npm ci

say "Building for production"
npm run build

# Local rehearsal only. This lets an invoice be settled from its own page,
# which is what makes the top-up flow walkable without an admin. It is
# never set on the server — see deploy/README.md.
export IUNLOCKMOBILE_ALLOW_SELF_APPROVE=1
export IUNLOCKMOBILE_DB="$DB"
export NODE_ENV=production
export PORT

say "Starting on http://localhost:$PORT"
# next directly rather than through npm, so Ctrl-C reaches the server
# instead of stopping at an npm wrapper and orphaning it.
npx next start --hostname 127.0.0.1 --port "$PORT" &
SERVER_PID=$!
cleanup() {
  pkill -P "$SERVER_PID" 2>/dev/null || true
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 40); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/health" || true)" = "200" ]; then
    READY=1
    break
  fi
  sleep 1
done

if [ "${READY:-0}" != "1" ]; then
  echo "The app did not answer within 40s."
  exit 1
fi

if [ "$DEMO" = "1" ]; then
  say "Seeding a demo account"
  node scripts/seed-demo.mjs
fi

cat <<BANNER

  ────────────────────────────────────────────────────────────
   iUnlockMobile is running the production build

   Site        http://localhost:$PORT
   Sign in     http://localhost:$PORT/login
   Database    $DB
BANNER
if [ "$DEMO" = "1" ]; then
  cat <<BANNER
   Demo login  demo / demo-password-123

   Try an unlock with 354909000000095 (delivered)
   or           354909000000020 (carrier refuses, credit returned)
BANNER
fi
cat <<BANNER

   Not rehearsed here: Caddy and TLS. That layer needs a public
   hostname to get a certificate. Check its config with
   caddy validate --config deploy/Caddyfile

   Ctrl-C to stop.
  ────────────────────────────────────────────────────────────

BANNER

wait $SERVER_PID

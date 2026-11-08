#!/usr/bin/env bash
# Merge into the live branch, preserve production-only features, build before swapping.
set -euo pipefail
umask 077
ref=${1:?Full reviewed commit SHA required}
[[ "$ref" =~ ^[a-f0-9]{40}$ && $(id -un) == ubuntu ]] || exit 1
app=/home/ubuntu/apps/unlockservice
cd "$app"
[[ -z $(git status --porcelain --untracked-files=no) ]] || { echo 'Tracked changes need review'; exit 1; }
sudo -v
original=$(git rev-parse HEAD)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="/home/ubuntu/apps/unlockservice-openai-$stamp"
git worktree add -b "release/openai-$stamp" "$release" "$original"
git -C "$release" merge --no-edit "$ref"
# This release changes no dependencies. Share installed dependencies to avoid disk copies.
git diff --exit-code "$original" HEAD -- package.json package-lock.json >/dev/null
cmp "$app/package-lock.json" "$release/package-lock.json"
ln -s "$app/node_modules" "$release/node_modules"
cd "$release"
node --import tsx --test tests/*.test.ts
npm run build
cd "$app"
[[ $(git rev-parse HEAD) == "$original" && -z $(git status --porcelain --untracked-files=no) ]]
changed=0
paused=0
rollback() {
  code=$?
  trap - ERR
  if [[ "$changed" == 1 ]]; then
    sudo systemctl stop unlockservice.service || true
    if [[ -d "$app/.next-pre-openai-$stamp" ]]; then
      [[ ! -d "$app/.next" ]] || mv "$app/.next" "$app/.next-failed-openai-$stamp"
      mv "$app/.next-pre-openai-$stamp" "$app/.next"
    fi
    git -C "$app" reset --keep "$original" || true
    sudo systemctl start unlockservice.service || true
  fi
  if [[ "$paused" == 1 ]]; then sudo systemctl start unlockservice-poll.timer unlockservice-ads.timer || true; fi
  echo 'Deployment stopped; inspect health. No customer database was restored.'
  exit "$code"
}
trap rollback ERR
paused=1
sudo systemctl stop unlockservice-poll.timer unlockservice-ads.timer
for unit in unlockservice-poll.service unlockservice-ads.service; do
  for attempt in $(seq 1 60); do
    state=$(sudo systemctl show "$unit" -p ActiveState --value)
    [[ "$state" != active && "$state" != activating ]] && break
    [[ "$attempt" != 60 ]] || { echo 'Worker still busy'; false; }
    sleep 2
  done
done
mkdir -p /home/ubuntu/backups
python3 - "$app/data/iunlockmobile.db" "/home/ubuntu/backups/iunlockmobile-pre-openai-$stamp.db" <<'PY'
import sqlite3, sys
with sqlite3.connect('file:' + sys.argv[1] + '?mode=ro', uri=True) as source:
    with sqlite3.connect(sys.argv[2]) as target:
        source.backup(target)
PY
sudo systemctl stop unlockservice.service
changed=1
git branch "backup/pre-openai-$stamp" "$original"
git merge --ff-only "release/openai-$stamp"
mv .next ".next-pre-openai-$stamp"
mv "$release/.next" .next
sudo systemctl start unlockservice.service
healthy=0
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then healthy=1; break; fi
  sleep 2
done
[[ "$healthy" == 1 ]]
sudo systemctl start unlockservice-poll.timer unlockservice-ads.timer
paused=0
changed=0
trap - ERR
if ! sudo test -e /etc/unlockservice-openai.env; then
  sudo install -o root -g root -m 600 /dev/null /etc/unlockservice-openai.env
  sudo tee /etc/unlockservice-openai.env >/dev/null <<EOF
IUNLOCKMOBILE_DB=$app/data/iunlockmobile.db
IUNLOCKMOBILE_PUBLIC_ORIGIN=https://iunlockmobile.com
OPENAI_ADS_MODE=validate
OPENAI_ADS_PIXEL_ID=2Ndima1oMiLLWcprFYcXs7
OPENAI_ADS_START_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Set OPENAI_ADS_CAPI_KEY securely on this server; never in source control.
EOF
fi
node_bin=$(command -v node)
sudo tee /etc/systemd/system/unlockservice-openai.service >/dev/null <<EOF
[Unit]
Description=iUnlockMobile OpenAI verified purchase sender
After=network-online.target
[Service]
Type=oneshot
User=ubuntu
Group=ubuntu
WorkingDirectory=$app
EnvironmentFile=-/etc/iunlockmobile.env
EnvironmentFile=-/etc/unlockservice-dhru.env
EnvironmentFile=-/etc/unlockservice.env
EnvironmentFile=/etc/unlockservice-openai.env
ExecStart=$node_bin --import tsx $app/scripts/deliver-openai-conversions.ts
UMask=0077
NoNewPrivileges=true
EOF
sudo tee /etc/systemd/system/unlockservice-openai.timer >/dev/null <<'EOF'
[Unit]
Description=Send eligible OpenAI conversions every two minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Unit=unlockservice-openai.service
[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
# Intentionally do not enable sending until a key and validate-only preflight are complete.
sudo systemctl is-active unlockservice.service unlockservice-poll.timer unlockservice-ads.timer
echo "OPENAI_TRACKING_DEPLOYED $(git rev-parse HEAD); CAPI awaits secure key setup"

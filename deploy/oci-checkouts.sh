#!/usr/bin/env bash
# Build a merged production release before swapping the website; install/upgrade the OCI worker.
set -euo pipefail
umask 077
ref=${1:?Full reviewed commit SHA required}
[[ "$ref" =~ ^[a-f0-9]{40}$ && $(id -un) == ubuntu ]] || exit 1
app=/home/ubuntu/apps/unlockservice
cd "$app"
[[ -z $(git status --porcelain --untracked-files=no) ]] || { echo 'Tracked changes need review'; exit 1; }
[[ -d .next && -d node_modules && -f data/iunlockmobile.db ]] || exit 1
sudo -v
original=$(git rev-parse HEAD)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="/home/ubuntu/apps/unlockservice-oci-$stamp"
git worktree add -b "release/oci-$stamp" "$release" "$original"
git -C "$release" merge --no-edit "$ref"
cd "$release"
npm ci
node --import tsx --test tests/*.test.ts
npm run build
cp -a node_modules "$app/.node-modules-oci-ready-$stamp"
cp -a .next "$app/.next-oci-ready-$stamp"
cd "$app"
[[ $(git rev-parse HEAD) == "$original" && -z $(git status --porcelain --untracked-files=no) ]] || { echo 'Production changed during build'; exit 1; }
sudo systemctl stop unlockservice-poll.timer
ads_installed=0
if sudo test -f /etc/systemd/system/unlockservice-ads.service; then
  ads_installed=1
  sudo systemctl stop unlockservice-ads.timer
fi
# Let in-flight provider/conversion requests finish rather than terminating paid work.
for unit in unlockservice-poll.service unlockservice-ads.service; do
  for attempt in $(seq 1 600); do
    state=$(sudo systemctl show "$unit" -p ActiveState --value 2>/dev/null || true)
    [[ "$state" != active && "$state" != activating ]] && break
    if [[ "$attempt" == 600 ]]; then
      sudo systemctl start unlockservice-poll.timer
      [[ "$ads_installed" == 0 ]] || sudo systemctl start unlockservice-ads.timer
      echo 'Worker still busy; website has not been changed'; exit 1
    fi
    sleep 2
  done
done
changed=0
rollback() {
  code=$?
  trap - ERR
  if [[ "$changed" == 1 ]]; then
    sudo systemctl stop unlockservice.service || true
    if [[ -d "$app/.next-pre-oci-$stamp" ]]; then
      [[ ! -d "$app/.next" ]] || mv "$app/.next" "$app/.next-failed-oci-$stamp"
      mv "$app/.next-pre-oci-$stamp" "$app/.next"
    fi
    if [[ -d "$app/.node-modules-pre-oci-$stamp" ]]; then
      [[ ! -d "$app/node_modules" ]] || mv "$app/node_modules" "$app/.node-modules-failed-oci-$stamp"
      mv "$app/.node-modules-pre-oci-$stamp" "$app/node_modules"
    fi
    git -C "$app" reset --keep "$original" || true
    sudo systemctl start unlockservice.service || true
  fi
  sudo systemctl start unlockservice-poll.timer || true
  [[ "$ads_installed" == 0 ]] || sudo systemctl start unlockservice-ads.timer || true
  echo 'Deployment failed; inspect service status. No customer database was restored.'
  exit "$code"
}
trap rollback ERR
mkdir -p /home/ubuntu/backups
python3 - "$app/data/iunlockmobile.db" "/home/ubuntu/backups/iunlockmobile-pre-oci-$stamp.db" <<'PY'
import sqlite3, sys
with sqlite3.connect('file:' + sys.argv[1] + '?mode=ro', uri=True) as source:
    with sqlite3.connect(sys.argv[2]) as target:
        source.backup(target)
PY
sudo systemctl stop unlockservice.service
changed=1
git branch "backup/pre-oci-$stamp" "$original"
git merge --ff-only "release/oci-$stamp"
mv .next ".next-pre-oci-$stamp"
mv node_modules ".node-modules-pre-oci-$stamp"
mv ".next-oci-ready-$stamp" .next
mv ".node-modules-oci-ready-$stamp" node_modules
sudo systemctl start unlockservice.service
healthy=0
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then healthy=1; break; fi
  sleep 2
done
[[ "$healthy" == 1 ]]
sudo systemctl start unlockservice-poll.timer
changed=0
trap - ERR
if [[ "$ads_installed" == 0 ]]; then
  bash "$release/deploy/data-manager.sh" "$ref"
else
  # Preserve the original cutoff, destination, credentials and delivery ledger on upgrade.
  sudo mkdir -p /etc/systemd/system/unlockservice-ads.service.d
  node_bin=$(command -v node)
  sudo tee /etc/systemd/system/unlockservice-ads.service.d/release.conf >/dev/null <<EOF
[Service]
WorkingDirectory=$release
ExecStart=
ExecStart=$node_bin --import tsx $release/scripts/deliver-ads-conversions.ts
EOF
  sudo systemctl daemon-reload
  sudo systemctl start unlockservice-ads.service
  sudo systemctl enable --now unlockservice-ads.timer
fi
sudo systemctl is-active unlockservice.service unlockservice-ads.timer
sudo journalctl -u unlockservice-ads.service -n 8 --no-pager -o cat
echo "Website and OCI release: $(git rev-parse HEAD)"

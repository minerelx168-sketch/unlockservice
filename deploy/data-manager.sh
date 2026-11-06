#!/usr/bin/env bash
# Install the sender independently of Next.js. Execute as ubuntu on the production VM.
# Usage: bash deploy/data-manager.sh <reviewed-sender-commit>
set -euo pipefail
umask 077
release_ref=${1:?Pass the reviewed sender commit SHA}
[[ "$release_ref" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected a full commit SHA'; exit 1; }
[[ $(id -un) == ubuntu ]] || { echo 'Run as ubuntu'; exit 1; }
production=/home/ubuntu/apps/unlockservice
database="$production/data/iunlockmobile.db"
credentials=/home/ubuntu/.config/gcloud/application_default_credentials.json
[[ -f "$database" && -r "$credentials" ]] || { echo 'Missing production DB or ADC'; exit 1; }
sudo -v
if sudo test -e /etc/systemd/system/unlockservice-ads.service; then
  echo 'Ads service already installed. Preserve its original rollout cutoff; use the upgrade instructions.'
  exit 1
fi
cd "$production"
[[ -z $(git status --porcelain --untracked-files=no) ]] || { echo 'Tracked production changes need review'; exit 1; }
git cat-file -e "$release_ref^{commit}"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="/home/ubuntu/apps/unlockservice-ads-$stamp"
# Retain production-only safety fixes; never reset the website to origin/main.
git worktree add -b "release/ads-$stamp" "$release" HEAD
cd "$release"
git merge --no-edit "$release_ref"
npm ci
npm run typecheck
node --import tsx --test tests/ads-data-manager.test.ts tests/ads-conversion-outbox.test.ts
start_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
chmod 600 "$credentials"
export GOOGLE_APPLICATION_CREDENTIALS="$credentials"
export IUNLOCKMOBILE_PUBLIC_ORIGIN=https://iunlockmobile.com
export ADS_DATA_MANAGER_MODE=validate
export ADS_DATA_MANAGER_ACCOUNT_ID=2980233695
export ADS_DATA_MANAGER_CONVERSION_ID=7892563655
export ADS_DATA_MANAGER_PROJECT_ID=iunlockmobile-data-manager
export ADS_DATA_MANAGER_START_AT="$start_at"
# Uses the same Node ADC library as the worker; hard-coded validateOnly, no real purchase.
node --import tsx scripts/deliver-ads-conversions.ts --preflight
mkdir -p /home/ubuntu/backups
python3 - "$database" "/home/ubuntu/backups/iunlockmobile-pre-ads-$stamp.db" <<'PY'
import sqlite3, sys
source = sqlite3.connect('file:' + sys.argv[1] + '?mode=ro', uri=True)
target = sqlite3.connect(sys.argv[2])
with target:
    source.backup(target)
target.close()
source.close()
PY
sudo install -m 600 /dev/null /etc/unlockservice-ads.env
sudo tee /etc/unlockservice-ads.env >/dev/null <<EOF
ADS_DATA_MANAGER_MODE=live
ADS_DATA_MANAGER_ACCOUNT_ID=2980233695
ADS_DATA_MANAGER_CONVERSION_ID=7892563655
ADS_DATA_MANAGER_PROJECT_ID=iunlockmobile-data-manager
ADS_DATA_MANAGER_START_AT=$start_at
EOF
node_bin=$(command -v node)
sudo tee /etc/systemd/system/unlockservice-ads.service >/dev/null <<EOF
[Unit]
Description=iUnlockMobile Google Data Manager conversion sender
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=ubuntu
Group=ubuntu
WorkingDirectory=$release
EnvironmentFile=-/etc/iunlockmobile.env
EnvironmentFile=-/etc/unlockservice-dhru.env
EnvironmentFile=-/etc/unlockservice.env
EnvironmentFile=/etc/unlockservice-ads.env
Environment=NODE_ENV=production
Environment=IUNLOCKMOBILE_PUBLIC_ORIGIN=https://iunlockmobile.com
Environment=IUNLOCKMOBILE_DB=$database
Environment=GOOGLE_APPLICATION_CREDENTIALS=$credentials
ExecStart=$node_bin --import tsx $release/scripts/deliver-ads-conversions.ts
TimeoutStartSec=20min
UMask=0077
EOF
sudo tee /etc/systemd/system/unlockservice-ads.timer >/dev/null <<'EOF'
[Unit]
Description=Run iUnlockMobile conversion sender every two minutes

[Timer]
OnBootSec=90s
OnUnitInactiveSec=2min
Unit=unlockservice-ads.service

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl start unlockservice-ads.service
sudo systemctl enable --now unlockservice-ads.timer
sudo systemctl is-enabled unlockservice-ads.timer
sudo systemctl is-active unlockservice-ads.timer
sudo journalctl -u unlockservice-ads.service -n 8 --no-pager -o cat
echo "Sender installed at $release; production website unchanged. Cutoff: $start_at"

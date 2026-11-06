# Data Manager sender

The dedicated worker discovers completed, charged purchases with consented checkout context and
drains the staging table every two minutes. OCI staging does not require GA4 configuration or delivery.
The website/provider worker continues completing orders as before. This release does not change bids,
Primary/Secondary settings, or upload historical sales. Keep the offline action Secondary.

## Configuration

All fields are required; absent/invalid configuration disables delivery:

```
ADS_DATA_MANAGER_MODE=live
ADS_DATA_MANAGER_ACCOUNT_ID=2980233695
ADS_DATA_MANAGER_CONVERSION_ID=7892563655
ADS_DATA_MANAGER_PROJECT_ID=iunlockmobile-data-manager
ADS_DATA_MANAGER_START_AT=<fixed ISO UTC rollout timestamp>
IUNLOCKMOBILE_PUBLIC_ORIGIN=https://iunlockmobile.com
IUNLOCKMOBILE_DB=/home/ubuntu/apps/unlockservice/data/iunlockmobile.db
GOOGLE_APPLICATION_CREDENTIALS=/home/ubuntu/.config/gcloud/application_default_credentials.json
```

Use `validate` instead of `live` for request validation. Validated rows are not sent rows;
live promotion rechecks their eligibility. The cutoff is immutable for a deployment. Never move
it backward to bulk-replay old data. ADC uses `google-auth-library`; no keys or tokens belong in git.
Current ADC impersonates a service account using user credentials: revoked/expired user access can
stop unattended authentication. Monitor the service and migrate to workload identity when available.

## Installation

On the production VM as ubuntu, fetch the reviewed commit and run
`bash deploy/data-manager.sh <full-commit-sha>` from its checkout (or extract that script using
`git show <sha>:deploy/data-manager.sh`). The installer checks tracked changes, makes a separate
worktree from the current production HEAD and merges the sender commit so production-only fixes
are preserved. It installs dependencies and runs typecheck and sender tests, validates ADC and
destination without recording any conversion, takes a SQLite online backup, then installs and
starts the dedicated service/timer. Existing `.next-*` backups and Google verification files are untouched.
No Next.js rebuild/restart is needed to run this standalone worker. The main website stays at its
existing revision until its next ordinary deployment.

## Delivery guarantees and limits

- Additive `ads_conversion_delivery` ledger, unique by transaction ID, pinned to its original destination.
- Immediate SQLite transaction claims a row. Another worker cannot send it concurrently.
- Rechecks current consent/click ID, account owner, amount/currency, completed service, matching
  charge, live guest payment, internal/test status, refund/review and wallet reversal evidence.
- A conservative 30-day event-age limit and explicit rollout cutoff prevent unbounded replay.
- Stable transaction ID and original timestamp are preserved for Google deduplication.
- Explicit 401/403/429 rejection retries with backoff, at most five attempts. Timeouts, interrupted
  workers, malformed responses and 5xx responses are `uncertain` and are NOT automatically replayed.
- `accepted` means Google queued the request. `delivered` requires a matching destination with
  `SUCCESS` from requestStatus. This still does not prove attribution to a real click or bidding credit.
- Polling persists only sanitized error/warning enum codes. No email, IMEI, IP, token or raw payload
  appears in logs. GCLID is sent only in the API body to Google, never in a request URL.
- Consent/refund eligibility is a snapshot at submission, not an atomic transaction with Google.
  Refunds, disputes or consent withdrawals discovered after acceptance set `needs_review`.
  **Automatic conversion retractions are not implemented.** Review and adjust already-uploaded
  conversions before making this action Primary. Do not clear its delivery ledger to reupload.
- Signed-in consent withdrawal is supported by existing context revocation. Anonymous historical
  withdrawal cannot be linked without verified checkout identity; this release does not solve that.

## Verification

```
sudo systemctl is-active unlockservice-ads.timer
sudo journalctl -u unlockservice-ads.service -n 20 --no-pager -o cat
```

Expected sequence for a new eligible real order: staging → accepted → delivered (or a specific
error/warning). Empty staging is not evidence of successful real-order delivery. Never place a
paid order or fabricate an ad click merely to produce a successful diagnostic.

`npm run ads:status` prints aggregate counts when run in the release with the same environment and
database. The default local DB must not be confused with production. Status does not send data.
`npm run ads:deliver -- --preflight` validates a synthetic request with `validateOnly` hard-coded.

## Stop / rollback / upgrade

Stop future sends: `sudo systemctl disable --now unlockservice-ads.timer`, then
`sudo systemctl stop unlockservice-ads.service`. Stopping an in-flight send may produce an uncertain
result; never replay it blindly. These operations do not undo a conversion already sent to Google.
The additive table may remain; do not restore an old database over new customer orders.

For an upgrade, stop the timer, let any active oneshot finish, prepare/test a new release worktree,
then change WorkingDirectory/ExecStart to that release. Keep `/etc/unlockservice-ads.env`, its original
cutoff and the database delivery ledger. Reload systemd, start the service, inspect logs and re-enable
the timer. The first-install script deliberately refuses to overwrite an existing ads service.

Official API references:
- https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/send-events
- https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest
- https://developers.google.com/data-manager/api/reference/rest/v1/requestStatus/retrieve
- https://developers.google.com/data-manager/api/devguides/quickstart/set-up-access


## Checkout capture coverage

Server capture is independent of GA4 browser IDs and GA4 diagnostics. Capture occurs before
Whop card top-up creation, before guest crypto payment instructions are returned, on guest card
checkout, on wallet order/report submission, on crypto top-up and on the legacy invoice form.
Only granted consent retains click IDs. Organic/direct/AI visits may legitimately have no click ID;
never synthesize one. Whop metadata retains the opaque invoice/order reference that joins to the
server-side checkout context rather than copying raw identifiers into extra systems.

`ads:status` also groups seven days of actual checkout records by kind and attribution status:
missing_context, granted-with-gclid/braid, unknown/denied, and consented_without_ad_click.
Historical missing_context rows cannot be repaired by guessing an ad click.
Capture changes require deploying the website code as well as upgrading the independent worker.

For the checkout-capture release, use `bash deploy/oci-checkouts.sh <full-reviewed-sha>`.
It builds/tests a production-ancestry worktree before pausing the website briefly to swap the
build and dependencies. It keeps untracked verification/backup files and creates a database
backup plus a rollback branch. It then installs or upgrades the Ads worker, preserving an
existing cutoff. If Google authentication fails during worker activation, the website may
already be updated: inspect both service statuses rather than assuming an all-or-nothing deploy.

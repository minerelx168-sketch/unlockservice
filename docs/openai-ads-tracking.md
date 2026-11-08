# OpenAI Ads purchase measurement

Account: iUnlockMobile. Windsor connector `openai_ads`, account `1789`.
Pixel: `2Ndima1oMiLLWcprFYcXs7`. Conversion: `iUnlockMobile Paid Purchase`, base event `order_created`.

## Attribution and reporting

The existing Ad 1 uses:

```
utm_source=chatgpt&utm_medium=cpc&utm_campaign=iunlockmobile-openai&utm_content=ad-1&campaign_id={campaign_id}&ad_id={ad_id}&ad_group_id={ad_group_id}
```

OpenAI supplies `oppref` on ad clicks. The website captures the original opaque value with its landing context, persists a 30-day cookie only after explicit consent, and snapshots it into `ga4_checkout_context.oppref`. A new OpenAI click replaces older landing attribution and prevents fallback to a stale Google click. Unknown/denied consent stores no reference. Signed-in withdrawal clears it. This release also stores `utm_content`.

GA4 continues receiving its existing server purchase, with the existing transaction ID and revenue. OpenAI delivery never emits another GA4 event or Google OCI. `chatgpt / cpc` identifies paid traffic; a ChatGPT referral without that paid evidence is not an OpenAI Ads purchase.

Windsor can already read OpenAI spend/clicks/conversions and GA4. This integration does not create a second connector or upload the customer database to Windsor. Join the campaign's stable UTM label `iunlockmobile-openai` to OpenAI campaign `cmpn_c90bf85b5b64819ab155d3bcd3b236a4`; `ad-1` corresponds to `ad_6d9e63de55e8819b85f200600e3f14af`. Additional ads need distinct content labels. Normalize THB ad spend and USD sales before calculating ROAS. Keep platform-attributed conversions and GA4 attribution separate, not summed.

## Server purchase sender

`lib/openai-ads.ts` uses the same financial eligibility checks as Google OCI but requires an OpenAI reference instead of a Google click. Paid and fulfilled website orders only; excludes wallet topups, unpaid orders, mock/sandbox, admin/internal users, refunds and unresolved payment reviews. A new delivery ledger atomically claims each transaction, pins the Pixel ID, and checks current consent/financial state before sending. Revenue uses integer USD cents. `opt_out` is true. No email, IMEI, IP, user agent or customer hashes are exported. This first version deliberately does not implement view-through matching or browser Pixel events.

The rollout cutoff is fixed in `/etc/unlockservice-openai.env`. No historical backfill; API event timestamps must also be within seven days. Completed services arriving after that limit are excluded, not given a fabricated event time. API 2xx is `submitted`, not proof of Ads attribution. Uncertain sends and explicit API failures never auto-replay. Investigate manually, retaining the same ID for any approved retry. Subsequent refund or consent change is flagged `needs_review`; no remote retraction is claimed.

## Install and activate

`deploy/openai-tracking.sh FULL_SHA` builds a merge on top of production HEAD, retains production-only fixes, backs up SQLite, swaps the verified build with rollback, and installs an inactive OpenAI worker/timer. Existing Google sender and provider polling resume. No new dependencies are required.

Before activation, create the account's Conversion API key in Ads Manager and store it as `OPENAI_ADS_CAPI_KEY` in the root-only `/etc/unlockservice-openai.env`. Never place it in GitHub, a URL, browser JS, logs, or chat. Preserve `OPENAI_ADS_START_AT` on upgrades. Configuration defaults to `OPENAI_ADS_MODE=validate`.

Run a one-off worker with `scripts/deliver-openai-conversions.ts --preflight` under the same systemd environment. The preflight always uses `validate_only:true`, including when mode is live; it does not record a synthetic purchase. After successful authentication/schema validation and authorization for real conversion delivery, change mode to `live`, start `unlockservice-openai.service`, and enable `unlockservice-openai.timer`.

Inspect aggregate logs and `--status`. Validate a real eligible order's state, original amount/time, and its appearance in Ads Manager Event Stream, then Windsor. Do not create a fake payment or replace a missing click reference to manufacture a success. The existing clicks campaign has not been switched to conversion bidding by this release.

Official API: https://developers.openai.com/ads/conversions-api

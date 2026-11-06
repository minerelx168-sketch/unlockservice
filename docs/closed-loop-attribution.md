# Closed-loop attribution update — 2026-11-06

## Implemented

- Click attribution expires after 30 days. Existing signed 90-day consent cookies fail closed and require a new consent choice after this release.
- Validated landing path, UTMs and click IDs persist in a first-party Secure/SameSite=Lax cookie only after explicit consent. Direct revisits retain attribution without refreshing its original expiry; a new tagged campaign replaces it. Refusal deletes the cookie and session context.
- GA client/session IDs are read from Google's tag at checkout, not invented or copied from an expired session. This does not alter Google's own cookie lifetime.
- Guest checkout context is stored before creating the external Whop checkout. Whop metadata carries the existing opaque order reference; matching attribution remains in our DB.
- Existing verified-payment and completed-service gates remain. `purchase.value` now equals the sum of charged item prices, with known `gross_margin` reported separately. Card purchases retain their existing charged-item fee treatment; tax is excluded. Top-ups remain `payment_completed`, value zero. No historical events are replayed or rewritten.
- Eligible, explicitly consented Google ad purchases are staged once in `ads_conversion_outbox`. These rows are NOT uploads. Organic/AI visits, unknown/denied consent and internal visits are excluded. GA4 delivery failure does not mark Ads as delivered.

## Not enabled: Data Manager delivery

No Data Manager credentials or conversion destination have been configured or verified. No Ads API calls are made. The outbox is preparation only and currently follows the existing GA4 eligibility worker (GA4 must be enabled).

To enable a production sender, configure server-only Google OAuth/Cloud authorization and the destination Ads account/conversion action. Validate revenue versus profit bidding, designate one purchase action for bidding (GA4 import or direct upload), and inspect custom goals to prevent duplicates. Do not change campaign bidding merely by deploying this code.

Before sending any staged record, recheck consent, refund/dispute/review status, account, conversion time/window and destination. Implement durable leases, response diagnostics, idempotent transaction identifiers and refund adjustments. Do not bulk-send this table as-is: a payment can be refunded after staging. Signed-in consent withdrawal already suppresses and clears staged click IDs; anonymous withdrawal needs a verified checkout reference before historical records can be matched.

Official references:
- https://developers.google.com/data-manager/api/devguides
- https://developers.google.com/google-ads/api/docs/conversions/upload-offline
- https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- https://support.google.com/google-ads/answer/11461796

## Rollout checks

Run typecheck, lint, tests and build. Deploy by merging into the existing production release branch, preserving server-only checkout safety commits. Do not reset production to main. Inspect new GA4 payloads for `value == sum(items.price * quantity)` and stable transaction IDs. Historical dashboard totals span two value definitions; compare cohorts by deployment time.

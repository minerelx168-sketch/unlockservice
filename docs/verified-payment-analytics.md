# Verified funding measurement

Payment completion is sent by the existing payment worker, after Whop has retrieved and verified a paid live payment (or a blockchain transfer is verified) AND the invoice has the corresponding balance-changing top-up ledger entry. Opening an invoice never emits completion. Purchase remains a distinct charged, successfully delivered service event; free/admin services stay excluded.

At checkout, the browser retrieves real GA client/session IDs via gtag only after consent. The authenticated server verifies its signed consent cookie before saving those IDs against a new pending invoice. No emails, IP addresses, wallet addresses, IMEIs, fake IDs, or historical backfill are sent. Withdrawal on a signed-in account suppresses pending events and clears identifiers. Missing consent/blocked gtag means no server event.

The funding event carries transaction_id `topup-<invoice reference>`, actual credited value (USD, excluding card fee/tax), currency, and one Account credit item. This is funding, not service revenue. Keep the Google Ads funding conversion value at zero if service purchase carries revenue, to avoid double-valuing the same money.

## Activation

Base release: release/seo-editorial-final-20261020 (072eedd). Do not deploy main over production: main lacks production payment functionality.

1. Confirm the live commit and reconcile any subsequent changes. Back up SQLite and the app build. Schema change is additive: payment_analytics only. No financial ledger writes are performed by analytics.
2. Create a Measurement Protocol API secret for stream G-9WCELVR3V3. Store it only in the protected server environment as GA4_MEASUREMENT_API_SECRET. Never put it into NEXT_PUBLIC variables or Git.
3. Set GA4_SERVER_PAYMENTS_ENABLED=1 and IUNLOCKMOBILE_PUBLIC_ORIGIN=https://iunlockmobile.com in the existing payment worker environment, as well as the web service. Restart/reload services per deployment procedure. Verify the payment poll timer is running.
4. Deploy this entire change atomically: browser completion is removed and server delivery replaces it. Do not enable without a secret and functioning worker.
5. Perform one genuine small mobile top-up from a nonadmin account that accepts optional tracking. Check gateway paid state, ledger, payment_analytics state, GA4 event parameters, then an actual charged service purchase. Do not create synthetic production conversions or click your own live ad.
6. Verify GA4/Ads attribution independently: a transport 2xx is not evidence of GA4 processing, nor a guaranteed Ads conversion. MP session attribution also depends on Google's timing limits. No artificial engagement duration is added.

## Delivery and operations

An atomic database claim prevents repeated page visits or concurrent workers from sending the same invoice again. MP does not offer an exactly-once guarantee for custom events. A timeout, non-2xx, or interrupted send is marked uncertain and never automatically retried. Investigate GA4 before any manual replay; transaction_id alone is not guaranteed to deduplicate a custom payment_completed event. A 2xx is recorded as submitted, not verified received.

Inspect counts without exposing customer identifiers:

```sql
SELECT state, COUNT(*) FROM payment_analytics GROUP BY state;
```

Pending contexts expire after 90 days; only settlements within 48 hours are eligible for delivery. A skipped/blocked event must never block payment settlement. Existing GA4 purchase requires charged and delivered orders and remains independently subject to consent.

Rollback: restore previous app/build and disable GA4_SERVER_PAYMENTS_ENABLED; keep the additive table for diagnosis. Never replay submitted/uncertain rows automatically.

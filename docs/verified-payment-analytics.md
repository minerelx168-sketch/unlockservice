# Verified payment measurement — Phase 0

Google Ads receives `purchase` and `payment_completed` only for money that actually arrived from real customers, with `value` = gross margin. Everything is sent by the server payment worker (`scripts/poll-provider-jobs.ts`, run by `unlockservice-poll.timer`). No page sends a purchase or an Ads conversion.

## Events

| Event | When | value | Other parameters |
|---|---|---|---|
| `purchase` | Account order delivered / report completed with a matching charge (`payment_method: credit`), or a paid guest checkout whose report completed (`card` / `crypto`) | Price charged for the service (no card fee, no tax) − provider cost from `catalog/service-margins.json` | `items[0]`: service ID, name, category, price actually paid; `customer_type` new/returning |
| `payment_completed` | Verified top-up credited to the wallet | **0**: credit is funding, not profit. Profit is counted once, when the credit buys a service | `topup_amount`, `payment_method`, `customer_type` |

Example: AT&T USA Clean (718) sells at $4.99 and costs $0.05, so the `purchase` value is 4.94.

Keep `payment_completed` a **Secondary** conversion in Google Ads. Only `purchase` and `payment_completed` should be GA4 key events.

## Rules

- **Once per transaction.** The worker claims `(transaction_id, event_name)` in `ga4_events_sent` before sending. A claimed row is never sent again. Non-2xx, timeout or crash = `uncertain` and is **never retried automatically**: Measurement Protocol has no exactly-once guarantee.
- **Real customers only.** Skipped as `internal_user`: admin accounts, emails on `INTERNAL_EMAIL_DOMAINS`, and checkouts created from `INTERNAL_IPS`. Free services, $0 orders, refunds, sandbox payments and unverified transfers never qualify.
- **Consent.** In the EEA, UK and Switzerland Google tags are denied until the visitor accepts. Elsewhere they are granted by default (Google's region-specific consent default in `app/layout.tsx`). A visitor who rejects in Privacy choices is never sent: `consent_denied`.
- **No browser ID.** If the checkout did not pass a GA client ID (blocked tag, slow load), the sale is still sent with a random fallback client ID so GA4 counts revenue, recorded as `missing_client_id`. It cannot be attributed to an ad click.
- **Unknown cost.** If a service has no cost in the sheet or the catalog, `value` = net price and the event is marked `margin_unknown`.
- **No backfill.** Only payments after `ga4_meta.delivery_started_at` (first start of this release) and within the last 48 hours are eligible.
- **No personal data.** No names, emails, IMEIs, wallet addresses or IPs are sent. `user_id` is the internal numeric ID and is sent only with a real browser client ID.

What a checkout knew (consent choice, internal flag, landing path, first UTM tags, gclid/gbraid/wbraid) is stored in `ga4_checkout_context`. The IP address itself is never stored.

## Environment (web service and poll timer — both files)

| Variable | Value |
|---|---|
| `GA4_SERVER_PAYMENTS_ENABLED` | `1` |
| `GA4_MEASUREMENT_ID` | `G-9WCELVR3V3` (default if unset) |
| `GA4_MP_API_SECRET` | Measurement Protocol secret for that stream. `GA4_MEASUREMENT_API_SECRET` also works |
| `IUNLOCKMOBILE_PUBLIC_ORIGIN` | `https://iunlockmobile.com` |
| `INTERNAL_IPS` | Comma-separated team public IPs |
| `INTERNAL_EMAIL_DOMAINS` | Optional, comma-separated team email domains |

Never put the secret in a `NEXT_PUBLIC_` variable or in Git. After changing either file, restart the web service and `unlockservice-poll.timer`.

## Checks

1. `/admin/tracking` shows **Enabled · G-9WCELVR3V3** and a **Delivery started** time.
2. `sudo journalctl -u unlockservice-poll -n 20` shows `"paymentAnalytics":{"submitted":…` and no `"disabled":true`.
3. The daily table compares Ads clicks / GA4 `google/cpc` sessions (entered by hand until the APIs are connected; target ≥ 70%) with paid orders and what was sent.

Inspect without customer identifiers:

```sql
SELECT event_name, state, reason, COUNT(*) FROM ga4_events_sent GROUP BY 1,2,3;
```

## Real-transaction test (passes Phase 0)

Phone on mobile data (not an `INTERNAL_IPS` address), a new ordinary customer account. Search Google for a keyword in the account and click the ad (do not type the URL). Confirm the landing URL has `gclid=`, buy AT&T Clean ($4.99) by card. Within 5 minutes GA4 DebugView/Realtime shows `purchase`, value 4.94, USD, `google / cpc`. Within 24–72 h Google Ads shows the conversion under the campaign. Refunding afterwards does not send another purchase.

## Rollback

Set `GA4_SERVER_PAYMENTS_ENABLED=0` (or remove the secret) and restart both services. The tables are additive; keep them for diagnosis. Never replay submitted or uncertain rows automatically.

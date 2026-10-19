# Customer analytics and daily growth

Routes: `/admin` (daily sales), `/admin/analytics` (five report tabs), and authenticated CSV downloads under `/api/admin/analytics/export`. Both pages and exports enforce administrator authorization before querying customer records. All report operations are read-only; existing credit adjustments and payment verification remain separate.

## What the numbers mean

- All money is integer cents internally. Reports and dates use Asia/Bangkok, including SQL timestamps and ISO timestamps at UTC midnight boundaries.
- Overview service sales are posted `charge` ledger effects for `order` and `paid_imei_report`. Held credit and released holds are not sales. Manual adjustments are not sales or top-ups.
- Payment credits use posted `topup` ledger effects linked to invoices. Whop credit reversals are separate. These are customer funding amounts, not processor payouts, profit or service sales.
- Overview growth compares the selected period with the preceding period of equal length. A current day is marked incomplete. The control panel compares seven complete days ending yesterday with the previous seven, and separately shows today's and yesterday's sales.
- Service tables use **request creation date**, with current outcome and charged amount. They combine carrier/device orders, paid reports (including paid unlock products), and free IMEI checks. A historical request charged this week can appear in this week's overview money, but outside this week's service request cohort.
- Top-up tables use **invoice creation date**, with current actual credit and Whop reversals. Pending invoice amounts never count as credit added. The amount due is an invoice value, not proof of a payment or receipt.
- Customer tables list all matching accounts, with period money/activity, current available/held balance, and lifetime paid-purchase count. Inactive means the most recent purchase was over 30 days ago as of today. It takes precedence over one-time/repeat status; the purchase count remains visible.
- Administrator accounts are excluded by default. The checkbox includes them for operational review. This does not automatically identify customer-role test accounts.
- Consented recorded Google click IDs provide a Google Ads signal. Unattributed traffic is not assumed to be SEO/direct. No campaign/keyword/ROAS data is invented.

Date ranges are limited to 366 days. Tables page at 25 records; CSV exports include all filtered records up to 10,000 and reject larger exports instead of silently truncating. Overview CSV contains daily monetary totals. Exports use UTF-8 BOM, quote fields and neutralize formula-leading strings. They omit device identifiers, raw click IDs, wallets, session tokens and provider payloads.

## Consented behavior and GA4

`CustomerEngagement` collects only authenticated **customer** visits after signed consent is granted. The endpoint validates the current session, signed consent, same origin, required custom header, body size, per-user rate limit and a fixed page-category allowlist. Browser-supplied user IDs are never trusted. Administrator and anonymous visits return `tracked:false`.

Two additive tables store random per-account `analytics_identities` and cumulative `customer_page_visits`. IP addresses are not collected or matched. The identifier is `u_` plus a random UUID, and has no username/email/account number embedded. It is returned only for the signed-in consenting account and shown to authorized administrators for correlation with GA4.

Timing counts visible, focused pages, ignores idle time after 60 seconds, caps delayed timer increments at five seconds and total active time per visit at one hour. A 15-second heartbeat persists cumulative time; repeated/out-of-order heartbeats cannot duplicate time. Server elapsed time limits client claims. Timing is an estimate, not proof of attention, and closing/crashing a tab or an interrupted network can lose the last heartbeat. These statistics are never used to credit funds, authorize actions, or prove identity.

The existing GA4 tag `G-9WCELVR3V3` receives the opaque ID as a **configuration** setting (not a custom dimension) and custom `account_page_view` / `account_page_engagement` events, with fixed `page_category` and `active_seconds`. This does not emit another `purchase`, alter Ads conversion accounting, or duplicate GA4's automatic `user_engagement` event. User-ID is cleared on navigation/consent denial; the authenticated endpoint must resolve the next identity again. Events are sent only on the production hostname allowlist. Private URLs and personal fields are never used as event properties.

Use GA4 User Explorer with the corresponding User-ID. Reporting Identity should be Observed or Blended. No GA4 account settings are changed by this release. Incoming Google events must still be confirmed in the property's Realtime/DebugView using a consenting customer; administrator traffic is deliberately excluded. Existing GA4 anonymous browsing remains separate. No historical behavior is reconstructed.

Detailed activity is only displayed for the last 90 days. An hourly opportunistic cleanup deletes up to 1,000 older visits per run; the identity remains for account correlation until an eligible deletion. The privacy page describes scope, consent and retention. Withdrawing consent stops future optional collection; historical deletion is handled through the existing account support process.

Official reference: https://developers.google.com/analytics/devguides/collection/ga4/user-id

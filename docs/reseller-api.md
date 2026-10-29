# Reseller Mode — API v1

Customer roles are RETAIL / RESELLER / ADMIN. The existing `account_type` values remain
`customer` / `reseller` / `admin` for compatibility; `users.role` is generated from them.
Internal guest settlement records are not customer roles and cannot authenticate.

A single verified wallet top-up of >= 10000 USD cents permanently upgrades RETAIL to
RESELLER. This is a one-time activation requirement; subsequent top-ups follow normal
payment limits and do not need to reach $100. Card fees/tax are excluded. Multiple smaller deposits, adjustments, test-mode
Whop payments and direct guest purchases never qualify. The migration honors historical
verified, unreversed qualifying deposits. Refunds do not downgrade membership, while
existing disputes/payment review, suspension and ban controls still block wallet spending.

`reseller_price_cents = ceil((retail_price_cents * 10000 + provider_cost_micros) / 20000)`.
Prices are generated from the existing catalog; no uploaded file overrides live retail
prices. Missing/invalid/above-retail costs make reseller ordering unavailable for that
service. Both authenticated web ordering and API ordering use the same price function.
Existing orders keep their recorded price. Guest retail checkout remains unchanged;
signed-in resellers are routed to wallet checkout.

## Authentication and endpoints

Open **Account → Reseller Mode** at `/user/reseller`. The API Docs section has copy
buttons for the base URL, Authorization header, full endpoint URLs and cURL requests.
Documentation examples contain placeholders and never include a real API key.

Create a key in the same page. Up to 3 active keys; only SHA256 hashes are stored.
Keys authorize only the owner's services, balance, orders and transactions. Revocation
and account suspension take effect immediately. Never embed a key in browser JavaScript.

Base: `https://iunlockmobile.com/api/reseller/v1`
Header: `Authorization: Bearer ium_live_...`

| Method | Path | Purpose |
|---|---|---|
| GET | /services | Active mapped services, identifiers, retail/reseller prices, ETA |
| GET | /balance | Available wallet balance (USD decimal string and integer cents) |
| POST | /orders | Create one wallet-paid order |
| GET | /orders | Owner's service history; up to 50, `?before=ID` cursor |
| GET | /orders/ID | Owner's status, normalized result, raw Provider result |
| GET | /transactions | Immutable available-wallet history; `?before=ID` cursor |

POST example (replace values from the current service catalog):
```http
POST /api/reseller/v1/orders
Authorization: Bearer YOUR_KEY
Idempotency-Key: store-order-000001
Content-Type: application/json

{"service_code":"SERVICE_CODE","identifier":"CUSTOMER_IMEI","expected_price_cents":800,"accepted_terms":true}
```
`expected_price_cents` is an optional server-side price confirmation; a mismatch is
rejected before spending. IMEI inputs require all 15 digits and Luhn validation. Serial,
phone and other specialized services retain their existing service-specific validators.
`accepted_terms` confirms device authorization and the published service terms.

Never change Idempotency-Key when retrying an uncertain response. The same order key
returns the existing order; different service/identifier with that key returns 409.
Insufficient balance returns 402. Request rate is 120/minute/account, new-order rate
600/hour/account. 429 includes Retry-After. Unknown errors return a generic 503 without
provider credentials or raw internal error messages. Result GETs never submit provider work.

## Money and fulfilment

Available wallet = `users.credit_cents - users.held_cents` (also exposed as generated
`wallet_balance_cents`). Creating an order and reserving/debiting available funds share
one SQLite IMMEDIATE transaction. Provider submission happens only after that commits.
A final success consumes the reservation; an explicit rejection releases it once.
Ambiguous provider timeouts remain manual_review and are not automatically resubmitted.
Existing polling and signed provider callbacks resolve pending jobs. Web and API results
appear in the same `/user/reports/ID` account page.

`wallet_transactions` is an append-only projection of available-money movements:
TOPUP, ORDER_DEDUCTION (reservation), AUTO_REFUND (release), ADMIN_ADJUSTMENT.
A successful charge does not deduct available funds a second time. An opening balance
entry records available funds on migration; prior detailed history remains in credit_ledger.
Both tables reject UPDATE/DELETE at database level. Corrections use compensating entries.
This protects application-level history; a database administrator can still alter schema,
so operational backups and restricted server access remain necessary.

## Result webhooks

Configure an HTTPS endpoint and obtain its one-time signing secret in `/user/reseller`.
Saving rotates the secret and endpoint version; already queued old-version events are not
sent to the replacement destination. Retrieve those orders through the authenticated API.
Disable stops further sends. No customer data is sent merely by saving the endpoint.

A transactional outbox queues `order.completed` or `order.refunded` on final settlement.
The existing scheduled worker delivers it independently of the customer browser. Immediate
API/provider callback processing also attempts delivery. Failed sends retry up to 12 times
with exponential backoff (60 seconds to 6 hours). Delivery is at-least-once; deduplicate by ID.

Body: `{"id":"EVENT_ID","event":"order.completed","data":{...order...}}`
Headers: X-IUnlockMobile-Event-Id, X-IUnlockMobile-Timestamp (Unix seconds),
X-IUnlockMobile-Signature (`sha256=HEX`). Verify with:
```js
import { createHmac, timingSafeEqual } from 'node:crypto';
const expected = createHmac('sha256', signingSecret)
  .update(`${eventId}.${timestamp}.${rawBody}`).digest();
const supplied = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
if (!/^\d+$/.test(timestamp) || Math.abs(Date.now()/1000-Number(timestamp)) > 300
    || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
  throw new Error('Invalid webhook');
}
// Persist eventId uniquely with the business update, then return 2xx promptly.
```
Use the raw body, not reserialized JSON. HTTPS certificate validation remains on. IPv4
DNS answers are validated and pinned per send; private/link-local/metadata/reserved ranges,
IP literal URLs, non-443 ports, credentials and redirects are refused. IPv6-only endpoints
are not supported in v1. Response bodies are not downloaded or logged. Results remain
accessible in the account and API if delivery fails.

Security design references:
- https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

## Release verification

Run lint, typecheck, the complete test suite and production build. Financial tests mock
external gateways and providers and use isolated SQLite databases: no live charges,
customer emails or paid provider requests. Before production migration, take an online
SQLite backup; rehearse against a copy of production. Confirm original credit integrity
and wallet SUM(amount_cents) reconciliation before/after. Never restore an old DB over
new payments during a code rollback. The migration is additive and old code can use the
original credit/hold columns; preserve the migrated DB on rollback.

# Credit orders, signed callbacks and notifications

This implementation uses the repository's existing Node.js runtime, Next.js
route handlers and `better-sqlite3`. It does not introduce an Express server or
a second balance database. The route-independent business functions are in
`lib/orders.ts`, `lib/paid-reports.ts` and `lib/provider-webhook.ts`.

## Accounting and transaction boundary

The existing accounting contract is **available = owned credit − held credit**.
Placing a pending order immediately removes its price from spendable credit by
creating a reservation. Success consumes that reservation and owned credit;
rejection releases the reservation. Amounts are integer USD cents, selected
from the server catalog, never from a request or callback.

| Outcome | Order status | Owned credit | Held credit | Available credit |
|---|---|---|---|---|
| Start with $10 | — | 1000 | 0 | 1000 |
| Place a $2 order | processing | 1000 | 200 | 800 |
| Success | delivered / completed | 800 | 0 | 800 |
| Alternatively, rejection | unavailable / refunded | 1000 | 0 | 1000 |

SQLite does not implement `SELECT … FOR UPDATE` row locks. Here
`db().transaction(fn).immediate()` uses **BEGIN IMMEDIATE** to acquire the database
writer lock before checking the request key and balance. This serializes writers
across Node processes using the same local SQLite file. WAL permits concurrent
readers, and a five-second busy timeout bounds contention. No `await` or provider
request runs inside a database transaction. See [SQLite transactions](https://www.sqlite.org/lang_transaction.html).

For PostgreSQL migration, the corresponding critical section is `BEGIN`,
`SELECT ... FROM users WHERE id = $1 FOR UPDATE`, request-key lookup,
order/reservation/ledger insertion and `COMMIT`, all on the **same connection**.
This allows unrelated users to write concurrently. It requires a real database
adapter migration; the SQLite schema cannot just be executed against PostgreSQL.
See [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

The working reservation code is `submitOrder()` and `createPaidReport()`.
`charge()`/`refund()` verify the original reservation's user, exact amount and
reference, reject opposite prior effects, and insert ledger transitions once.
Order status, balance movement and notification intent commit together. A
duplicate or conflicting terminal event returns the stored result without
overwriting a report or moving another order's reservation.

## Authenticated placement endpoints

The existing session cookie and CSRF token are required. User ID comes from the
session. Commands are limited to 16 KiB and must be JSON objects. The catalog
determines price and provider service mapping; supplying a price has no effect.

`POST /api/orders` (unlock):

```json
{
  "csrfToken": "TOKEN_FROM_THE_CURRENT_SESSION",
  "kind": "carrier_unlock",
  "brandId": 1,
  "carrierId": 103,
  "imei": "490154203237518",
  "email": "customer@example.com",
  "idempotencyKey": "UNIQUE_KEY_REUSED_FOR_THIS_ATTEMPT"
}
```

For a device service use `kind: "device_service"` and `serviceId` instead of
`carrierId`. A report uses `POST /api/imei/reports` with `csrfToken`, `productCode`
(for example `APPLE_BASIC`), `imei` and `idempotencyKey`. Internal service IDs and
product codes map to provider IDs through the existing operator-approved config.
The current approved paid-report catalog remains synchronous; existing async
report rows can also be settled by callback/polling. This change does not activate
unsupported services or change maintenance settings.

HTTP order placement requires a stable idempotency key (8–128 allowed characters).
The same user/key/request returns the original order, including after maintenance
or provider disablement. Reusing the key for different input returns 409.
Insufficient credit returns 402 and rolls back the new order. Rate limiting returns
429. IMEI length/checksum validation happens before any reservation or network call.
Legacy direct calls to `submitOrder` may omit the key; they cannot deduplicate
client retries and new callers should always provide it.

## Network uncertainty is not rejection

Transport uses an abort deadline (`IUNLOCKMOBILE_PROVIDER_TIMEOUT_MS`, 2–60 seconds,
default 30), disallows redirects, and caps response bytes while streaming at 1 MB.
Timeouts, connection loss, HTTP errors and malformed/empty replies retain credit
for reconciliation. Only an explicit provider business rejection releases it.
A code-based unlock is not charged until a usable unlock code is supplied.

There is deliberately no automatic placement retry: the current upstream
protocol has no documented idempotent placement key. A request can time out after
the upstream accepted it. Reuse the customer's original key and inspect the saved
order; do not place another order to recover the response. If the provider ID is
known, polling or a verified callback can settle it. If the ID was lost, an operator
must reconcile it with the upstream before binding a reference or releasing funds.
A process stopping after reservation but before submission has the same review
requirement. A durable dispatcher plus provider-side idempotency is a separate
integration, not a guarantee made by this code.

Do not switch the provider endpoint/account behind the same provider name while
orders remain open. Name changes/disabled config are detected; same-name account
replacement cannot be detected without a persisted provider-account identifier.

## Opt-in signed webhook

`POST /api/provider/webhook` uses its own HMAC authentication; it is not a browser
session/CSRF endpoint. **The currently documented synchronous provider has no
signed-callback contract.** This endpoint defines a new opt-in protocol for a
provider or trusted adapter that explicitly supports it. Do not enable it by
inventing an unsigned compatibility fallback.

Configure a dedicated random 32-byte secret as 64 hex characters in the server's
secret environment (`IUNLOCKMOBILE_PROVIDER_WEBHOOK_SECRET`), shared only with that
provider/adapter. Do not reuse the provider API key. Without valid configuration,
the endpoint returns 503. Identity comes from the configured provider name, not
from a caller-supplied provider or customer ID.

```json
{
  "eventId": "evt-provider-123-success",
  "resourceType": "order",
  "providerOrderId": "provider-123",
  "status": "success",
  "unlockCode": "12345678",
  "result": { "instructions": "Insert the new SIM and enter the unlock code." }
}
```

`resourceType` is `order` or `paid_imei_report`; `status` is `success` or `rejected`.
Paid report results use the existing sanitized report builder and must omit
`unlockCode`. Rejection needs no price, user ID or refund amount. A successful
callback without a usable result stays under review with its reservation intact.
Corrected provider data must use a new event ID.

Example sender code (sign and transmit exactly the same bytes):

```js
import { createHmac } from 'node:crypto'

const secret = process.env.IUNLOCKMOBILE_PROVIDER_WEBHOOK_SECRET
if (!/^[a-f0-9]{64}$/i.test(secret ?? '')) throw new Error('Webhook secret is missing')
const body = JSON.stringify(event) // the event object above; do not reserialize after signing
const timestamp = String(Math.floor(Date.now() / 1000))
const signature = createHmac('sha256', Buffer.from(secret, 'hex'))
  .update(timestamp).update('.').update(body).digest('hex')
const response = await fetch('https://YOUR_DOMAIN/api/provider/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Provider-Timestamp': timestamp,
    'X-Provider-Signature': `sha256=${signature}`,
  },
  body,
  signal: AbortSignal.timeout(10_000),
})
```

The receiver verifies exact raw bytes with [Node HMAC and timing-safe comparison](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b),
checks a ±300-second timestamp window, limits streamed requests to 64 KiB with a
five-second read deadline, and validates bounded fields before database work.
Provider name plus provider order ID must match exactly one stored resource.

| Response | Sender action |
|---|---|
| 200 | Acknowledge; duplicate and conflicting final events move no money |
| 401 | Fix signature, clock or secret; never downgrade authentication |
| 400 / 413 / 415 | Fix payload, body size or content type |
| 409 | Event ID reused for changed data; investigate rather than overwrite |
| 503 with Retry-After | Retry with backoff and a fresh signed timestamp |

Unknown/ambiguous references return 503 without consuming the event. This covers
a callback arriving before placement stores the provider reference. Retries keep
the same event ID and body but regenerate the timestamp/signature. Receipts store
only provider, event ID and payload hash; no raw callback, secret or IMEI is logged.
Receipt insertion, settlement and notification enqueue share one transaction.

## Durable notification worker

Configure `RESEND_API_KEY`, `IUNLOCKMOBILE_EMAIL_FROM` and the trusted
`IUNLOCKMOBILE_PUBLIC_ORIGIN` as for existing transactional email. After settlement,
run the bounded worker with the same DB/environment as the web process:

```sh
npm run notifications:deliver -- 20
```

Run it repeatedly from the deployment's worker scheduler. This command does not
install a timer itself. Notification intent is durable even if the web process
stops after commit; failed/unconfigured sends remain queued. Workers claim 30-second
leases, send outside the transaction with a 10-second deadline, and acknowledge
only their own lease token. Retries use capped exponential backoff and a stable
email idempotency key. Delivery is **at least once**: [Resend deduplicates for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys),
so a retry after that window can produce another email. Keep sender and public
origin stable while queued messages retry. Emails link to the authenticated
account page and exclude IMEIs, unlock codes and provider result bodies.

## Verification

```sh
npm run lint
npm run typecheck
node --import tsx --test tests/*.test.ts
npm run build
```

Tests use real temporary SQLite databases, separate Node processes for concurrent
placement, and mocked provider/email HTTP. Coverage includes overspending,
idempotent placement, timeout, explicit rejection, reservation ownership,
duplicate/conflicting callbacks, tampering, stale signatures, body limits,
callback/poll races, atomic refund/outbox rollback, notification retries and
lease replacement. They do not verify a live provider's callback support or
send real customer notifications. Existing data migration tests remain included.

Local verification on 7 September 2026: all 68 tests, lint, typecheck and the
production build passed. Multi-process tests caught and verified the fix for a
deferred rate-limit transaction that previously raised `database is locked`.

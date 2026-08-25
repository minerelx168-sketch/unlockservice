# imeihub Backend Architecture Migration

**Author:** Manus AI  
**Target:** `unlockservice`  
**Source reference:** `imeihub` branch `production` at commit `d053cbe`

## Objective

The migration adapts imeihub's production backend invariants to the existing Next.js and SQLite stack in `unlockservice`. It does not copy PHP or MySQL code directly, does not connect to the imeihub database, and does not modify imeihub data. Existing unlockservice users, sessions, orders, invoices, and credit history must remain readable throughout deployment.

## Architecture decision

| Concern | imeihub production pattern | unlockservice implementation |
|---|---|---|
| Account identity | Email/password, optional OAuth, server-side sessions | Preserve username plus email/password; strengthen server-side sessions and account status checks |
| Email verification | Six-digit OTP, hashed at rest, expiry, attempt cap, resend throttle | Add verification records and configurable email delivery; enforce verification only when the production flag and email provider are configured |
| Password recovery | OTP reset and session revocation | Add reset OTP flow and revoke every active session after a successful reset |
| Credit accounting | Append-only ledger is source of truth; cached balance is reconciled | Preserve integer cents; make balance-changing ledger rows authoritative and keep `users.credit_cents` as a reconciled cache |
| In-flight orders | imeihub deducts and refunds atomically | Preserve unlockservice's stronger escrow model: reserve credit first, then charge or release it atomically |
| Top-ups | Provider-neutral orders, idempotency keys, immutable credit issuance | Replace the unsafe invoice approval path with idempotent top-up orders and a single settlement function |
| Payment callbacks | Verified provider webhook plus raw event audit and replay protection | Add a provider-neutral webhook event store and settlement boundary; a real provider is enabled only when credentials/configuration exist |
| Schema evolution | Versioned SQL migrations | Add in-process, versioned SQLite migrations that only add compatible columns/tables/indexes |

## Data model additions

The migration adds `email_verifications`, `auth_rate_limits`, `topup_orders`, `webhook_events`, and `schema_migrations`. Existing `invoices` remain as legacy records and are not deleted. Existing users gain verification/session metadata through additive migrations. Existing `credit_ledger` rows remain intact; new rows receive an `affects_balance` marker so owned credit can be reconciled independently from reservation events.

## Credit invariants

> Owned balance equals the sum of balance-affecting ledger entries. Reserved credit is tracked separately and can never be negative or exceed owned balance.

Every credit mutation runs in one SQLite transaction. A top-up settlement is idempotent by both top-up order status and a unique ledger reference. A duplicate callback returns the previously settled order without issuing credit again. A service order reserves available credit, charges only after successful fulfilment, and releases the reservation if the supplier refuses or fails.

## Authentication invariants

Session identifiers and CSRF tokens remain opaque random values stored server-side. Authentication rejects inactive accounts, removes expired sessions, and records last-seen metadata. Login errors remain generic to avoid account enumeration. Verification and reset codes are stored only as SHA-256 hashes, expire after ten minutes, and are invalidated after five failed attempts.

## Payment availability

No placeholder wallet address may be shown to customers. A manual USDT method is exposed only when `IUNLOCKMOBILE_USDT_BEP20_ADDRESS` is configured. The settlement function is not callable by customers in production. Future Stripe, Lemon Squeezy, Binance Pay, or blockchain callbacks must verify their signatures before invoking settlement and must write the raw callback to `webhook_events` before processing.

## Deployment policy

Production remains in maintenance mode until supplier integration, payment destination/provider credentials, catalog pricing, and an administrative payment-review path are verified. The deployment process creates a timestamped SQLite backup before applying migrations. Health checks must validate both database access and ledger consistency.

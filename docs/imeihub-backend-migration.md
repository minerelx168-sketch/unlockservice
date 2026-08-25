# Unlockservice-first Backend Architecture

**Author:** Manus AI  
**Target:** `unlockservice`  
**Security reference:** `imeihub` branch `production` at commit `d053cbe`

## Objective

The backend keeps the original `unlockservice` architecture as its contract. The imeihub implementation contributes security and accounting invariants, but it does not replace unlockservice's module boundaries, invoice vocabulary, escrow flow, or SQLite-first deployment model. No PHP or MySQL code is copied, no imeihub database is connected, and no imeihub data is modified.

> The original unlockservice model remains authoritative: `lib/auth.ts` owns passwords and sessions, `lib/credits.ts` owns the escrow ledger, and `lib/payments.ts` owns invoices that are credited only after confirmation.

## Module boundaries

| Module | Responsibility | Compatibility rule |
|---|---|---|
| `lib/db.ts` | SQLite bootstrap, additive schema compatibility, catalog seed | Existing tables and rows are never deleted or renamed |
| `lib/auth.ts` | Password hashing, account registration/authentication, server sessions, CSRF | Preserve the original `User`, `Session`, `register`, `authenticate`, and session helper contracts |
| `lib/account-security.ts` | Email OTP verification, password-reset OTP, Resend delivery | Security extension; it must not own sessions or account balance |
| `lib/rate-limit.ts` | Small SQLite-backed attempt window helper | Shared by login and OTP flows without expanding `auth.ts` |
| `lib/credits.ts` | `hold → charge / refund` escrow transitions and append-only audit rows | `users.credit_cents` and `held_cents` remain the runtime balance; the ledger verifies rather than replaces that contract |
| `lib/payments.ts` | Invoice creation, reference submission, trusted confirmation | `Invoice`, legacy status names, `invoice` ledger references, and existing pages remain the public model |
| `lib/actions.ts` | Thin form adapters, error mapping, redirects | Business rules remain in `lib/*`; actions do not become a second service layer |

## Authentication compatibility

Registration remains an account operation in `lib/auth.ts`. When email verification is enabled, the account is created unverified and `lib/account-security.ts` sends a short-lived six-digit code. Verification creates the normal unlockservice session and redirects into the workspace. Password reset uses the same OTP storage and revokes all existing sessions after changing the password.

The original production default remains safe: verification is enforced only when `IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION=1`, `RESEND_API_KEY`, and `IUNLOCKMOBILE_EMAIL_FROM` are configured. Existing accounts are marked verified by the additive migration so deployment cannot lock out prior users.

## Credit compatibility

The original escrow semantics are preserved without reinterpretation:

```text
available --hold--> held --charge--> spent
                       └--refund--> available
```

`users.credit_cents` is the amount owned, `users.held_cents` is the reserved portion, and available credit is their difference. Every transition writes a ledger row. `hold` and `refund` remain availability movements; `charge`, `topup`, and `adjustment` change owned credit. Health checks compare balance-changing ledger rows with the cached owned balance but normal reads do not silently rewrite customer balances.

Top-up crediting is idempotent through a unique `(ref_type, ref_id, type)` ledger effect. The canonical reference remains `ref_type = 'invoice'`, so the existing Orders and Payments pages continue to render references correctly.

## Invoice compatibility

`invoices` is the canonical top-up table. It retains the original statuses `pending`, `review`, `success`, `failed`, and `refunded`. Provider identifiers, idempotency keys, and settlement timestamps are additive invoice columns rather than a second public order model.

The previously introduced `topup_orders` and `webhook_events` tables remain readable for backward compatibility. Compatibility migration imports any top-up row missing from `invoices`, maps it to the original status vocabulary, and preserves provider metadata. New application writes go only to `invoices`.

No placeholder destination is exposed. The original `crypto_networks` gateway identifier is available only when `IUNLOCKMOBILE_USDT_BEP20_ADDRESS` is configured. Customer reference submission never credits an account; only trusted confirmation can call the idempotent settlement boundary.

## Schema policy

Schema evolution stays inside `lib/db.ts` because the application is intentionally provision-free SQLite. Compatibility changes are additive and idempotent. A migration may add columns, tables, indexes, or backfill a derived compatibility view, but it may not delete legacy data, alter an existing identifier, or rewrite completed financial rows.

Before every production deployment, the SQLite online backup is created and checksummed. After restart, deployment verification must include `PRAGMA integrity_check`, the migration record, credit-ledger mismatch counts, service status, local health, and external HTTPS health.

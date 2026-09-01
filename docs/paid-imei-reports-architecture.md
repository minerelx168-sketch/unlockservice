# Paid IMEI Reports Architecture (Model B)

## Decision

Paid Provider reports are a separate product domain from the existing Free IMEI Check. The free workflow remains local-only, repeatable, and does not create invoices, holds, charges, or refunds. Paid reports use the existing `users.credit_cents` / `users.held_cents` escrow contract and the append-only `credit_ledger`.

The design adopts the useful boundaries from `minerelx168-sketch/imeihub` production: a curated catalog with stable internal product codes, a separate usage/order record with a price snapshot, a provider mapping kept outside customer-facing UI, owner-scoped history/detail endpoints, and service-specific output curation. It intentionally does not copy imeihub's raw IMEI/raw response storage or immediate debit behavior.

## Architecture mapping

| imeihub concept | unlockservice implementation | Adaptation |
|---|---|---|
| `service_prices` | `paid_report_products` | Integer USD cents, Provider cost in integer micro-USD, default inactive. |
| `service_usages` | `paid_report_orders` | Stores HMAC fingerprint + masked IMEI, never raw input. Includes idempotency and Provider metadata. |
| `data/services.php` | `lib/paid-report-catalog.ts` | Curated stable codes/slugs/copy; Free Check is not included. |
| `service_provider_map.php` | `IUNLOCKMOBILE_IMEI_SERVICE_MAP` | Provider IDs/modes stay deployment configuration. |
| `service_result_fields.php` | `lib/imei-report.ts` policies | Only allowlisted, service-specific report fields are stored/rendered. |
| Immediate `USAGE` debit | Existing `hold()` / `charge()` / `refund()` | Hold before submission, charge only after a usable report, refund on terminal failure. |

## Aggregate and lifecycle

`paid_report_orders` is the financial aggregate. It owns a price snapshot and one credit reference (`ref_type = paid_imei_report`, `ref_id = order id`). The allowed states are:

```text
processing (credit held)
  ├─ completed (hold charged; normalized report stored)
  ├─ refunded (hold released after unambiguous terminal failure)
  └─ manual_review (hold retained after timeout/network ambiguity)
```

A `manual_review` row is not automatically retried. The synchronous Provider API does not document an idempotency key or definitive charge-on-timeout behavior, so a repeated execution could consume Provider credit twice. Manual review must determine whether to deliver, refund, or run a separately authorized replacement request.

## Submission contract

1. Require the existing server-side session and matching CSRF token.
2. Validate the stable product code, active catalog state, Provider-enabled state, exact mapping, and 15-digit Luhn-valid IMEI before any hold.
3. Apply a SQLite-backed per-user rate limit.
4. Normalize an optional client idempotency key; the unique `(user_id, idempotency_key)` constraint prevents a replay from creating a second hold or Provider call.
5. In one SQLite transaction, insert `paid_report_orders` with a price snapshot and privacy-safe identifier fields, then call the existing `hold()` escrow function.
6. Stamp the Provider name/mode/service ID and record a sanitized `submitted` event before the network call.
7. Submit exactly once. Never put the API key or IMEI in the URL for `unlock-service`.
8. On a completed response, build a service-specific allowlisted report. If at least one supported field is present, atomically convert the hold to a charge and mark the order `completed`.
9. On an explicit terminal rejection, atomically release the hold and mark the order `refunded`.
10. On timeout, network ambiguity, unreadable success, or a completed payload with no supported public fields, retain the hold and mark the order `manual_review`; do not retry automatically.

## Privacy and ownership

The database stores `imei_fingerprint` and `masked_imei`, never a raw IMEI/serial column. Raw input exists only in request memory while submitting to the Provider. `report_json` contains only normalized fields; IMEI, IMEI2, serial, MEID and similar identifiers are masked before persistence. Unknown Provider fields and the raw upstream payload are discarded. All list/detail/poll reads include `user_id`; another customer receives the same not-found response as a missing order.

## Catalog and activation

The initial catalog contains the candidate Provider products as inactive rows. Product codes are stable (`APPLE_BASIC`, `APPLE_ICLOUD_STATUS`, `APPLE_WARRANTY`, `APPLE_CARRIER_LITE`, `BLACKLIST_SIMPLE`, `BLACKLIST_FULL`, `SAMSUNG_INFO`, `PIXEL_INFO`). Proposed prices are snapshots only until the owner approves them. Activation requires both an approved catalog flag and an exact `check:<lowercase_code>` mapping. Provider mode remains disabled until an authorized live test.

## API and pages

| Route | Purpose |
|---|---|
| `GET /user/reports/new` | Select an active paid report and enter an IMEI; shows current available credit. |
| `POST /api/imei/reports` | CSRF-protected, idempotent submission. |
| `GET /user/reports` | Owner-scoped paid report history, separate from Free Checks and Unlock Orders. |
| `GET /user/reports/[id]` | Owner-scoped normalized report and financial status. |
| `POST /api/imei/reports/[id]` | Manual status refresh for documented async mappings only; never retries an ambiguous sync request. |

## Financial invariants

A paid report must have exactly one `hold` and exactly one terminal effect: `charge` for a delivered report or `refund` for terminal failure. `credit_cents` equals the sum of balance-affecting ledger rows; `held_cents` is never negative and never exceeds `credit_cents`. Free IMEI checks never create paid report rows or ledger entries. Tests must cover insufficient credit, duplicate idempotency keys, concurrent/repeated settlement, Provider-disabled and unmapped rejection before hold, owner isolation, sanitized audit metadata, and raw-identifier absence from persisted report JSON.

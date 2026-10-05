# iUnlockMobile Provider Architecture

**Author:** Manus AI

**Source of patterns:** `imeihub` production branch
**Target:** `unlockservice` Next.js + SQLite

This change ports provider-facing invariants only. It does not copy API keys, production rows, customer identifiers, upstream service IDs, or live pricing from `imeihub`.

## Architecture decision

`unlockservice` remains the source of truth for accounts, catalog, orders, free IMEI checks, invoices, credit escrow, sessions, and UI contracts. The existing `Supplier` and `ImeiCheckProvider` boundaries remain canonical. The imported architecture adds normalized synchronous/DHRU transport, service mappings, polling, retries, sanitized audit events, and a disabled-by-default recovery command.

Production remains `provider-disabled` until the operator supplies authorized credentials and explicitly approves each service mapping.

## Provider modes

| Mode | Initial request | Normalized result | Follow-up |
|---|---|---|---|
| Local | No external request | `completed` | None |
| Sync | Provider service ID + IMEI | `completed` or `unavailable` | None |
| DHRU | `placeimeiorder` via form POST with XML `parameters` | `processing` with provider reference | `getimeiorder` polling with the same reference |

DHRU statuses `successful`, `success`, `done`, `complete`, `completed`, and the tested numeric status `4` map to terminal success. Explicit `rejected`, `failed`, `cancelled`, `canceled`, and `error` responses map to terminal unavailable. Other numeric or unknown states remain processing unless an explicit Provider error envelope exists. A transient network failure during polling remains processing rather than creating a false failure.

## Target module boundaries

| Module | Responsibility |
|---|---|
| `lib/provider-api.ts` | Environment validation, service-map parsing, bounded HTTP transport, sync/DHRU requests, response normalization and secret redaction |
| `lib/provider.ts` | Maps normalized provider outcomes into the existing Unlock `Supplier` contract |
| `lib/imei-check-provider.ts` | Maps normalized outcomes into the existing IMEI check contract; local validation remains default |
| `lib/provider-events.ts` | Sanitized audit events without raw IMEI, URLs, credentials or raw provider bodies |
| `lib/provider-jobs.ts` | Bounded reusable polling worker for legacy orders, paid services and free checks |
| `scripts/poll-provider-jobs.ts` | Operator command; no schedule is installed while provider is disabled |

## Configuration contract

| Environment variable | Purpose |
|---|---|
| `IUNLOCKMOBILE_PROVIDER_MODE` | `disabled` or `enabled`; default disabled |
| `IUNLOCKMOBILE_PROVIDER_NAME` | Safe adapter label, such as `dhru` or `unlock-service` |
| `IUNLOCKMOBILE_PROVIDER_URL` | HTTPS-only synchronous/PHP endpoint |
| `IUNLOCKMOBILE_PROVIDER_API_KEY` | Synchronous/PHP provider key |
| `IUNLOCKMOBILE_PROVIDER_DHRU_URL` | HTTPS-only DHRU Fusion endpoint; required separately for unlock-service |
| `IUNLOCKMOBILE_PROVIDER_DHRU_KEY` | DHRU API key; no fallback to the PHP key for unlock-service |
| `IUNLOCKMOBILE_PROVIDER_DHRU_USERNAME` | DHRU account username |
| `IUNLOCKMOBILE_UNLOCK_SERVICE_MAP` | JSON map from target catalog keys to provider descriptors |
| `IUNLOCKMOBILE_IMEI_SERVICE_MAP` | JSON map from target check types to provider descriptors |
| `IUNLOCKMOBILE_PROVIDER_TIMEOUT_MS` | Bounded request timeout |

A descriptor is `{ "id": "provider-service-id", "mode": "sync" | "dhru" }`. Legacy unlock mappings use `carrier:<carrier_id>` or `service:<service_id>`. Paid catalog mappings use `product:<lowercase_product_code>` and remain root-only deployment configuration. Upstream IDs are not customer-facing business identifiers.

## Financial and privacy invariants

The `imeihub` debit-first design is not copied. Unlock orders preserve `hold -> charge` on delivery and `hold -> refund` on terminal rejection. Existing ledger uniqueness remains the final replay boundary. Free IMEI checks never create invoices and never touch credit.

Free-check records continue storing only HMAC fingerprint plus masked IMEI. Raw IMEI is held transiently during an authorized provider request and is never added to `provider_events`. Provider URLs, query strings, credentials, raw bodies, and unfiltered upstream objects are excluded from audit data and client responses.

## State transitions

| Resource | Transition | Financial effect |
|---|---|---|
| Unlock | `processing -> delivered` | Charge the existing hold exactly once |
| Unlock/paid service | `processing -> completed` | Charge the existing hold exactly once |
| Unlock/paid service | `processing -> refunded` | Refund the existing hold exactly once |
| Unlock/paid service | ambiguous placement/poll result | Keep the hold for manual reconciliation; never re-place automatically |
| IMEI check | `queued -> processing/completed/unavailable` | None |
| IMEI check | `processing -> completed/unavailable` | None |
| Any terminal resource | duplicate poll | Return stored state; never downgrade |

Client polling is debounced. The worker selects bounded batches and calls the same business functions as user-triggered polling. An opt-in signed callback route now exists at `/api/provider/webhook`; it requires explicit provider/adapter support for the documented HMAC and event-ID protocol. There is no unsigned fallback, and the current synchronous provider is not assumed to support callbacks. See [credit orders and signed callbacks](backend-order-webhooks.md) for atomic settlement, timeout recovery and the notification worker.

## Additive data model

Migration `2026-08-provider-architecture-v1` adds provider name/mode/service, last-poll timestamp, attempt count and safe error code to existing order/check records. It adds `provider_events` for sanitized timings and state events. It does not remove, rename, or rewrite financial rows or legacy provider references.

## Catalog synchronization policy

Service-list discovery is an operator workflow, not a runtime dependency. The owner-approved strict rollout joins live PHP/DHRU catalogs to the canonical product catalog by exact Service ID and opens only IMEI-only products with a positive live margin. The approved manifest contains 99 products (45 IMEI checks and 54 unlock services); 31 products remain blocked for non-positive margin, unsupported inputs, restricted eligibility, or missing live catalog coverage. Wholesale prices never overwrite customer pricing automatically.

## Deployment policy

Production rollout requires validated root-only PHP/DHRU credentials, an exact 99-entry product map, additive migration `2026-09-provider-product-catalog-v3-strict-rollout`, and the bounded two-minute oneshot poll timer. The timer polls stored references only; it never places a replacement order. Paid DHRU work uses adaptive eligibility: every two minutes for the first five attempts, every ten minutes through attempt nineteen, then hourly. The 31 blocked products remain inactive even when Provider mode is enabled.

## Source references

1. `imeihub/includes/imei_provider.php`
2. `imeihub/api/services/use.php`
3. `imeihub/api/services/status.php`
4. `imeihub/scripts/poll-dhru-orders.php`
5. `imeihub/scripts/fetch-provider-services.php`
6. `imeihub/data/service_provider_map.php`
7. `unlockservice/lib/provider.ts`
8. `unlockservice/lib/orders.ts`
9. `unlockservice/lib/imei-check-provider.ts`
10. `unlockservice/lib/imei-checks.ts`

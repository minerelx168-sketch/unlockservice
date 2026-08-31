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
| DHRU | `placeimeiorder` with service + IMEI | `processing` with provider reference | `getimeiorder` polling |

DHRU statuses `successful`, `success`, `done`, `complete`, and `completed` map to terminal success. `rejected`, `failed`, `cancelled`, `canceled`, and `error` map to terminal unavailable. Queue-like or unknown non-terminal states remain processing. A transient network failure during polling remains processing rather than creating a false failure.

## Target module boundaries

| Module | Responsibility |
|---|---|
| `lib/provider-api.ts` | Environment validation, service-map parsing, bounded HTTP transport, sync/DHRU requests, response normalization and secret redaction |
| `lib/provider.ts` | Maps normalized provider outcomes into the existing Unlock `Supplier` contract |
| `lib/imei-check-provider.ts` | Maps normalized outcomes into the existing IMEI check contract; local validation remains default |
| `lib/provider-events.ts` | Sanitized audit events without raw IMEI, URLs, credentials or raw provider bodies |
| `lib/provider-jobs.ts` | Bounded reusable polling worker for async orders and checks |
| `scripts/poll-provider-jobs.ts` | Operator command; no schedule is installed while provider is disabled |

## Configuration contract

| Environment variable | Purpose |
|---|---|
| `IUNLOCKMOBILE_PROVIDER_MODE` | `disabled` or `enabled`; default disabled |
| `IUNLOCKMOBILE_PROVIDER_NAME` | Safe adapter label, such as `dhru` or `unlock-service` |
| `IUNLOCKMOBILE_PROVIDER_URL` | HTTPS-only provider endpoint |
| `IUNLOCKMOBILE_PROVIDER_API_KEY` | Synchronous provider key |
| `IUNLOCKMOBILE_PROVIDER_DHRU_KEY` | Optional DHRU key; falls back to API key |
| `IUNLOCKMOBILE_PROVIDER_USERNAME` | DHRU account username |
| `IUNLOCKMOBILE_UNLOCK_SERVICE_MAP` | JSON map from target catalog keys to provider descriptors |
| `IUNLOCKMOBILE_IMEI_SERVICE_MAP` | JSON map from target check types to provider descriptors |
| `IUNLOCKMOBILE_PROVIDER_TIMEOUT_MS` | Bounded request timeout |

A descriptor is `{ "id": "provider-service-id", "mode": "sync" | "dhru" }`. Unlock mappings use `carrier:<carrier_id>` or `service:<service_id>`. IMEI mappings use `check:<check_type>`, initially `check:basic`. Upstream IDs are configuration; they are not business catalog IDs.

## Financial and privacy invariants

The `imeihub` debit-first design is not copied. Unlock orders preserve `hold -> charge` on delivery and `hold -> refund` on terminal rejection. Existing ledger uniqueness remains the final replay boundary. Free IMEI checks never create invoices and never touch credit.

Free-check records continue storing only HMAC fingerprint plus masked IMEI. Raw IMEI is held transiently during an authorized provider request and is never added to `provider_events`. Provider URLs, query strings, credentials, raw bodies, and unfiltered upstream objects are excluded from audit data and client responses.

## State transitions

| Resource | Transition | Financial effect |
|---|---|---|
| Unlock | `processing -> delivered` | Charge the existing hold exactly once |
| Unlock | `processing -> unavailable` | Refund the existing hold exactly once |
| Unlock | transient poll error | Keep processing; increment attempt/audit |
| IMEI check | `queued -> processing/completed/unavailable` | None |
| IMEI check | `processing -> completed/unavailable` | None |
| Any terminal resource | duplicate poll | Return stored state; never downgrade |

Client polling is debounced. The worker selects bounded batches and calls the same business functions as user-triggered polling. No generic unsigned callback route is exposed. A callback may be added later only when the selected provider supplies a documented signing protocol and replay identifier.

## Additive data model

Migration `2026-08-provider-architecture-v1` adds provider name/mode/service, last-poll timestamp, attempt count and safe error code to existing order/check records. It adds `provider_events` for sanitized timings and state events. It does not remove, rename, or rewrite financial rows or legacy provider references.

## Catalog synchronization policy

The `imeihub` service-list discovery is an operator workflow, not a runtime dependency. A future import tool may normalize provider service ID, name, wholesale cost, delivery estimate and inferred sync/DHRU mode. Imported services must remain inactive until mapped to an existing internal service and retail price is explicitly approved. Wholesale prices never overwrite customer pricing automatically.

## Deployment policy

The first deployment includes code, additive schema and tests while keeping `IUNLOCKMOBILE_PROVIDER_MODE=disabled`, maintenance mode enabled, no provider credentials, no service mappings and no background timer. Local IMEI validation remains active. The provider polling command exits safely with `enabled: false`.

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

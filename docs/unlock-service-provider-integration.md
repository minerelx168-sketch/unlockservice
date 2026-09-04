# unlock-service.net PHP Provider Integration

## Scope

This integration uses the Provider's synchronous PHP API at `https://api.unlock-service.net`. The endpoint accepts `service`, `imei` or serial input, and a PHP API key. The application keeps its existing provider-neutral boundaries, IMEI privacy model, owner scoping, rate limits, audit sanitation and financial invariants.

No production service is enabled by this code alone. `IUNLOCKMOBILE_PROVIDER_MODE` remains `disabled`, and no mapping is active until the owner approves the service, input type and customer-facing price.

## Verified live contract

| Concern | Live behavior |
|---|---|
| Transport | HTTPS GET and POST are documented; this adapter uses POST form encoding so the API key and IMEI do not appear in the URL, proxy access logs or browser history. |
| Execution parameters | `service`, `imei`, `key` |
| Account parameters | `accountinfo=servicelist` or `accountinfo=balance`, plus `key` |
| Envelope | `success`, `response`, `object`; parser also accepts the documented legacy field `status`. |
| Service-list object | Dictionary keyed by service ID, with `service`, `name`, `price`, `time`, and `description`. |
| Report object | Documentation shows a list containing one structured object; the parser also accepts a direct object. |
| Job model | Synchronous. No job ID, callback signature, replay token or polling contract is documented. |
| Retry rule | Never retry an ambiguous execution automatically because a repeated call may create a second Provider charge. |

## Stable internal mapping

The public website must use stable internal check types. Provider service IDs remain deployment configuration rather than UI constants.

```json
{
  "check:apple_basic": { "id": "214", "mode": "sync" },
  "check:apple_carrier_lite": { "id": "444", "mode": "sync" },
  "check:apple_warranty": { "id": "806", "mode": "sync" },
  "check:apple_icloud": { "id": "10", "mode": "sync" },
  "check:blacklist_simple": { "id": "419", "mode": "sync" },
  "check:blacklist_full": { "id": "66", "mode": "sync" },
  "check:samsung_info": { "id": "9", "mode": "sync" },
  "check:pixel_info": { "id": "584", "mode": "sync" }
}
```

This is a candidate map only. Production configuration must remain empty until the owner selects approved services and confirms retail prices. Higher-cost GSX/case-history services and phone-number lookup services are excluded from the initial map.

## Normalized report

Provider payloads are converted to a presentation-oriented object instead of exposing arbitrary upstream JSON.

| Field | Purpose |
|---|---|
| `schemaVersion` | Versioned report contract, initially `1`. |
| `checkType` | Stable internal check type. |
| `source` | Sanitized provider name, never the endpoint or key. |
| `title` | Customer-facing report title. |
| `summary` | Short completion statement without unsupported claims. |
| `sections` | Ordered report sections containing allowlisted label/value rows. |
| `checks` | Optional status rows for boolean/security results. |
| `nextStep` | Safe guidance; never implies an unlock or ownership guarantee. |

Recognized upstream fields include device model, serial, IMEI, refurbishment/demo/replacement state, Find My status, iCloud status, lost mode, blacklist status, purchase date and country. IMEI and serial values are masked before storage. Unknown fields are omitted from the public report by default. The raw Provider body is not stored, rendered or written to audit logs.

## Pricing safety gate

Provider catalog cost is not a customer retail price. A service can be activated only after an explicit configuration entry defines the Provider service ID, input type, Provider cost snapshot and customer-facing price. The UI must not invent prices or silently subsidize paid Provider checks.

The first live service execution requires a user-provided test IMEI or serial number and explicit confirmation of the selected service's Provider cost. Account-info probes do not execute a service and are safe to run before that approval.

## Secret handling

The PHP API key is stored only in a root-owned EnvironmentFile with mode `0600`. It must not appear in Git, screenshots, application logs, audit records, error messages, query strings or customer reports. The endpoint is HTTPS-only and fixed by deployment configuration.

## Activation checklist

| Check | Required state |
|---|---|
| Provider key | Root-only EnvironmentFile, not source code |
| Production host IP | Present in Provider Linked IP list |
| Endpoint | Exact HTTPS origin `https://api.unlock-service.net` |
| Service map | Explicitly approved IDs only |
| Retail price | Approved for every paid service |
| Test input | User-authorized test IMEI/serial |
| Report fixture | Captured from the approved test and reviewed for sensitive fields |
| Failure behavior | No automatic retry after timeout/network ambiguity |
| Production mode | Remains disabled until all checks pass |

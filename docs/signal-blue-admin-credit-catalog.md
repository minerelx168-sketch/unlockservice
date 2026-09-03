# Signal Blue, Admin Credit and Product Catalog Contract

## Scope

This change updates the existing `unlockservice` application in place. It does not merge the separate CI/UX redesign branch, replace custom authentication, create a second credit balance, or change Provider retry behavior.

## Signal Blue CI

The semantic token names remain stable, but the brand palette changes from emerald/amber/moss to a Signal Blue family. Light mode uses `#0057B8` for primary actions, `#003F87` for hover/emphasis, and pale blue surfaces/borders. Dark mode uses a lighter blue with dark blue-black button text. Success, warning and danger remain distinct semantic status colors rather than being recolored blue.

Buttons have three explicit levels: a filled Signal Blue primary action, a blue-outline secondary action, and a quiet neutral tertiary action. The public header promotes **Browse services** as its single filled action. The homepage promotes the catalog first and Free IMEI Check second; order tracking remains a lower-emphasis action. Disabled controls must not resemble active purchase actions.

## Admin credit adjustment

Only a server-verified `account_type = 'admin'` session may access the Control Panel or call the mutation route. The route requires the existing session-bound CSRF token. It also requires a unique client idempotency key, a target user ID, a non-zero integer amount in cents, and a human-entered reason.

Adjustments use the existing `credit()` ledger path with type `adjustment`; direct user-balance updates outside the credit domain are prohibited. Negative adjustments are rejected when they would reduce total credit below held credit. The amount is limited to plus or minus USD 10,000 per action to reduce operator-error blast radius.

An additive `admin_credit_adjustments` audit table stores a public adjustment ID, administrator ID, target user ID, signed amount, reason, idempotency key, before/after credit and held balances, and timestamp. `(admin_user_id, idempotency_key)` is unique. Update/delete triggers make the audit rows append-only. The credit ledger reference type is `admin_credit_adjustment` and its reference ID is the public adjustment ID, so an interrupted or replayed request cannot create a second financial effect.

The Control Panel renders a searchable target selector, signed USD amount, required reason, current/held/available credit preview, explicit confirmation, and recent adjustment history. Password hashes and session tokens remain excluded.

## Product catalog dropdown

The public catalog continues to render all 109 published Unlock and IMEI Check cards with prices. Twelve zero-margin and eight restricted products remain hidden. A native accessible service dropdown is added above the cards and groups products by Available IMEI Reports, Coming-soon IMEI Checks, and Coming-soon Unlock Services. Selecting one service filters the cards to that exact product; **All services** restores the complete catalog.

Only products with canonical status `available` render an order button. Coming-soon Unlock and IMEI products show their owner-supplied price but render a disabled service state. No browser automation, guessed Unlock API mapping, automatic Provider retry, webhook or polling timer is added.

## Acceptance gates

Tests must prove admin RBAC, CSRF behavior at the route boundary, idempotent replay, negative-balance rejection, held-credit protection, append-only audit, exact ledger reference, and zero ledger mismatches. Catalog tests must preserve 129 canonical rows, 109 public rows, 25 orderable products, 84 coming-soon products, 12 hidden reprice rows and eight hidden restricted rows. Typecheck, lint, diff check, production build and isolated staging verification must pass before production deployment.

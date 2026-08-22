# Openline — device checks and unlocks

A Next.js app for a device-identity and unlock service. Two Cowork sessions fed it: **Website
design patterns** produced the design canvas the front end is built on, and **Baseimei.com backend
flow** produced the architecture reference the workspace is built on. Both are preserved in
`docs/reference/`.

Both references describe a third-party site, so what is carried across is the **system** — the
ratios and component anatomy on the design side, the flows and the credit model on the backend side
— while the palette, the type, the marks and every line of code here are our own. The design
transfer is written out in `docs/design-system.md` and rendered live at `/design-system`.

## Layout

```
app/layout.tsx              Root shell — theme guard, font preloads
app/(marketing)/            Public pages: homepage, living style guide
app/(auth)/                 Sign in, create account
app/(app)/user/             The workspace: dashboard, check, history, payments, invoice
app/api/checks/             Submit an order; /status polls one the provider accepted
lib/db.ts                   SQLite schema, seeded with the 38-service catalog
lib/credits.ts              The escrow ledger: hold → charge / refund
lib/checks.ts               The check pipeline both endpoints call
lib/payments.ts             Invoices: numbers locked at creation, credited on confirmation
lib/provider.ts             Provider adapter + the mock that stands in for a real one
lib/auth.ts                 Passwords, sessions, CSRF tokens
lib/imei.ts                 Luhn validation, grouping, identifier masking (no DOM)
styles/                     tokens · fonts · base · components · app · docs
public/fonts/               Self-hosted Bricolage Grotesque + Instrument Sans (OFL 1.1)
docs/design-system.md       The written design system
docs/reference/             The two source documents from the Cowork sessions
```

```sh
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + type-check + lint
npm run typecheck
```

Data lands in `data/openline.db` (SQLite, gitignored) and the schema is created on first request —
there is nothing to migrate or provision. The public pages make no external request: both faces are
served from `public/fonts/` and every icon is inline SVG.

## Trying the workspace

Create an account at `/register`, add funds, then run a check. The mock provider branches on the
last digit of the identifier, so all three outcomes are reachable:

| Identifier | What happens |
| --- | --- |
| `354909000000095` | The provider answers immediately; credit is charged |
| `354909000000012` | Accepted as pending, then resolves on a poll |
| `354909000000020` | The provider fails; the held credit is refunded in full |

Top-ups need a confirmation that would normally come from an administrator. In development the
invoice page offers to stand in for one; in production that button only appears when
`OPENLINE_ALLOW_SELF_APPROVE=1` is set. `OPENLINE_MAINTENANCE=1` puts the check form into
maintenance mode.

## Conventions

- **Tokens are the only place a colour is written.** No component hard-codes a hex, and
  `styles/globals.css` is the one import that pulls the sheets in dependency order.
- **Dark mode is one block.** `:root[data-theme='dark']` redefines the same names, re-pitched per
  role rather than inverted. A small inline script in each page head stamps the attribute before
  first paint so a dark reload never flashes white — which is why `<html>` carries
  `suppressHydrationWarning`.
- **Geometry is not brand.** Radii, control heights, border weights and shadow spreads come from the
  captured system unchanged; changing the palette should never require touching them.
- **Credit is escrowed, never deducted straight away.** `hold → charge` on success, `hold → refund`
  on failure, with a ledger row for every transition. A provider that times out must never cost the
  customer anything. This is the single most important thing carried over from the reference.
- **Two endpoints, not one.** `POST /api/checks` submits; `POST /api/checks/status` polls. Async
  provider work needs no websocket, and a slow lookup does not hold a request open.
- **The client never trusts the HTTP status alone** — it reads `success` off the parsed body, and
  treats an unparseable response as a failure.
- **Provider cost is never stored or shown.** `services.cost_price_cents` stays NULL until a real
  contract fills it; inventing a margin would put a fake number in the ledger.
- **The IMEI field never phones home on keystroke.** `lib/imei.ts` validates the 15-digit Luhn
  checksum in the browser and stays free of DOM and framework imports, so the same check runs in the
  server route.
- **Client components are the exception.** Only the header, the theme toggle and the IMEI field
  are `'use client'`; everything else renders on the server.

## Re-skinning

Palette, type and marks are the parts that are ours rather than the captured system's, so they are
the parts meant to change. To re-skin: edit the palette and `--font-*` blocks in
`styles/tokens.css`, drop replacement faces into `public/fonts/`, and swap the shield glyph in
`components/icons.tsx`. Nothing in `styles/components.css` needs to change — its radii, control heights
and shadow spreads are the transferred geometry.

The brand name **Openline** is the one the design canvas already used for this swap; it appears in
page copy, the `<title>`, and the footer.

## Not built yet

The reference documents more than this build covers. Still open: the admin side (invoice approval,
service and provider management), the API portal and its DHRU-compatible surface, reseller accounts
and credit transfer, the 7-day activity chart on the dashboard, server-side pagination in History,
email change and password reset, and rate limiting on the check endpoint.

## Accessibility

Every text/background pair clears 4.5:1 in both themes, checked against the surface each one
actually sits on. `--faint` is the single exception and is decorative only — placeholders and window
chrome, never copy a reader needs. White on amber is 3.1:1, so a filled amber button carries ink
instead; that is what `--on-accent` is for.

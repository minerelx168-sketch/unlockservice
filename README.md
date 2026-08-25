# iUnlockMobile — permanent IMEI phone unlocking

A Next.js app for a phone unlocking service: a customer gives an IMEI and the network their
device is locked to, the order is filed against that IMEI, and the unlock comes back as a remote
release or a code.

Two Cowork sessions fed the build. **Website design patterns** produced the design canvas the front
end is built on, and **Baseimei.com backend flow** produced the architecture reference behind the
workspace — the credit model, the two-endpoint order flow and the invoice flow all come from it.
Both are preserved in `docs/reference/`.

Both references describe a third-party site, so what is carried across is the **system** — the
ratios and component anatomy on the design side, the flows and the credit model on the backend side
— while the palette, the type, the marks and every line of code here are our own. The design
transfer is written out in `docs/design-system.md` and rendered live at `/design-system`.

## Layout

```
app/layout.tsx              Root shell — theme guard, font preloads
app/(marketing)/            Public pages: homepage, living style guide
app/(auth)/                 Sign in, create account
app/(app)/user/             The customer workspace: dashboard, unlock, orders, payments, invoice
app/(app)/admin/            Server-protected administrator control panel
app/api/orders/             Place an order; /status checks in on one the supplier accepted
lib/db.ts                   SQLite schema, seeded with brands, carriers and device services
lib/credits.ts              The escrow ledger: hold → charge / refund
lib/orders.ts               The order pipeline both endpoints call
lib/catalog.ts              Brands, carriers and their prices and turnarounds
lib/payments.ts             Invoices: numbers locked at creation, credited on confirmation
lib/provider.ts             Supplier adapter + the mock that stands in for a real one
lib/auth.ts                 Passwords, accounts, sessions, CSRF tokens, RBAC guards
lib/admin.ts                Read models for the administrator control panel
lib/account-security.ts     Optional email verification and password recovery
lib/rate-limit.ts           Small SQLite-backed attempt windows
lib/imei.ts                 Luhn validation, grouping, identifier masking (no DOM)
styles/                     tokens · fonts · base · components · app · docs
public/fonts/               Self-hosted Bricolage Grotesque + Instrument Sans (OFL 1.1)
docs/design-system.md       The written design system
docs/reference/             The two source documents from the Cowork sessions
deploy/                     Caddy site, systemd units, deploy and domain scripts
scripts/promote-admin.mjs    Idempotently promotes an existing account; never handles its password
```

Deploying is documented in [`deploy/README.md`](deploy/README.md) — including how the domain is
pointed at the server, and what is still a placeholder and must be replaced before the site takes
money.

```sh
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + type-check + lint
npm run typecheck
```

Data lands in `data/iunlockmobile.db` (SQLite, gitignored). The schema is created on first request and
additive compatibility migrations run in-process, so there is still nothing separate to provision. The public pages make no external request: both faces are
served from `public/fonts/` and every icon is inline SVG.

## What can be ordered

**Network unlock** — priced by the carrier holding the lock, delivered the way the brand allows.
Apple devices are released remotely; every other brand gets a code. Twenty carriers across four
countries are seeded.

**Device services** — flat-priced jobs that do not depend on a network: activation lock removal, MDM
profile removal, Google FRP removal, and cheap blacklist and full-device reports. Each one lists the
brands it covers, and the form only offers the ones that apply.

Every price and turnaround in `lib/catalog.ts` is a **placeholder schedule**, not a quote. Replace
them with your supplier's real terms before taking money.

## Trying the workspace

Create an account at `/register`, add funds, then place an order. The mock supplier branches on the
last digit of the IMEI:

| IMEI | What happens |
| --- | --- |
| `354909000000095` | Accepted, then delivered — credit is charged |
| `354909000000020` | The carrier refuses it — the held credit goes back in full |

A real unlock takes hours, so the page polls as a courtesy for the first thirty seconds and
everything else waits in Orders. The mock resolves in six seconds so the whole flow can be walked
without waiting a day.

Top-ups need a confirmation that would normally come from an administrator. In development the
invoice page offers to stand in for one; in production that button only appears when
`IUNLOCKMOBILE_ALLOW_SELF_APPROVE=1` is set. `IUNLOCKMOBILE_MAINTENANCE=1` pauses new orders.

Administrator access is an explicit `account_type = 'admin'` role checked on the server. The
`/admin` control panel never renders for a normal account. Create an account through `/register` so
the owner sets the password directly, then promote that existing account with
`npm run admin:promote -- <username-or-email>`. Promotion is idempotent and revokes existing
sessions so the new role is loaded only after a fresh sign-in.

## Conventions

- **Tokens are the only place a colour is written.** No component hard-codes a hex, and
  `styles/globals.css` is the one import that pulls the sheets in dependency order.
- **Dark mode is one block.** `:root[data-theme='dark']` redefines the same names, re-pitched per
  role rather than inverted. A small inline script in each page head stamps the attribute before
  first paint so a dark reload never flashes white — which is why `<html>` carries
  `suppressHydrationWarning`.
- **Geometry is not brand.** Radii, control heights, border weights and shadow spreads come from the
  captured system unchanged; changing the palette should never require touching them.
- **Credit is escrowed, never deducted straight away.** `hold → charge` when the unlock is
  delivered, `hold → refund` when the carrier refuses, with a ledger row for every transition. The
  money-back guarantee is enforced by the ledger rather than promised on a page.
- **Two endpoints, not one.** `POST /api/orders` places; `POST /api/orders/status` checks in. An
  order that takes two days holds no request open and needs no websocket.
- **`success` means the request was processed, not that the unlock worked.** A refused device comes
  back with `success: true` and `status: "unavailable"` — it is an outcome, not a failed request.
- **The client never trusts the HTTP status alone** — it reads `success` off the parsed body, and
  treats an unparseable response as a failure.
- **Supplier cost is never stored or shown.** Only the customer-facing price exists; inventing a
  margin would put a fake number in the ledger.
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

The brand is **iUnlockMobile** (iunlockmobile.com). The name appears in page copy, the `<title>`,
the footer and the lockup in `components/brand.tsx`; the mark itself is the `unlockMark` entry in
`components/icons.tsx`, mirrored in `app/icon.svg`, `app/favicon.ico` and `public/logo-mark.svg`.
Change it in those four places and the site follows.

## Not built yet

Still open: admin write operations (invoice approval, catalog and supplier management), emailing the result
to the customer, the API portal and its DHRU-compatible surface, reseller accounts and credit
transfer, the 7-day activity chart on the dashboard, server-side pagination in Orders, email change, and rate limiting on the order endpoint. There is also no background worker yet
— an order only advances when someone opens it or the console polls it.

## Accessibility

Every text/background pair clears 4.5:1 in both themes, checked against the surface each one
actually sits on. `--faint` is the single exception and is decorative only — placeholders and window
chrome, never copy a reader needs. White on amber is 3.1:1, so a filled amber button carries ink
instead; that is what `--on-accent` is for.

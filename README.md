# Openline — unlock service site

A Next.js app for a device-identity and unlock service, built on the design system captured in
the **Website design patterns** Cowork session. The marketing pages are in place; the backend —
API routes, schema and dashboard — is the next layer on the same shell.

The session produced a design canvas (`BaseIMEI Design System`) with five artboards: foundations,
component anatomy in light and dark, section patterns, and a rules/transfer sheet. That canvas
documents a third-party page, so what is carried into this repo is the **system** — the ratios, the
rhythm, the component anatomy — while the palette, the type and the marks are our own. The transfer
is written out in `docs/design-system.md` and rendered live at `/design-system`.

## Layout

```
app/layout.tsx           Root shell — theme guard, font preloads, header, footer
app/page.tsx             Homepage — the ten section patterns, in order
app/design-system/       Living style guide; specimens render from the real tokens
components/              Header, footer, brand lockup, theme toggle, IMEI form, icons
lib/imei.ts              Luhn validation, grouping and identifier masking (no DOM)
styles/                  tokens.css · fonts.css · base.css · components.css · docs.css
public/fonts/            Self-hosted Bricolage Grotesque + Instrument Sans (OFL 1.1)
docs/design-system.md    The written system: principles, tokens, patterns, transfer table
docs/reference/          The original canvas artboards
```

Next.js (App Router) with TypeScript. Both pages prerender as static content today; the
backend — API routes, schema and dashboard — lands on top of this shell.

```sh
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + type-check + lint
npm run typecheck
```

Both faces are served from `public/fonts/` and every icon is inline SVG, so the pages make no
external request.

## Conventions

- **Tokens are the only place a colour is written.** No component hard-codes a hex, and
  `styles/globals.css` is the one import that pulls the sheets in dependency order.
- **Dark mode is one block.** `:root[data-theme='dark']` redefines the same names, re-pitched per
  role rather than inverted. A small inline script in each page head stamps the attribute before
  first paint so a dark reload never flashes white — which is why `<html>` carries
  `suppressHydrationWarning`.
- **Geometry is not brand.** Radii, control heights, border weights and shadow spreads come from the
  captured system unchanged; changing the palette should never require touching them.
- **The IMEI field never phones home on keystroke.** `lib/imei.ts` validates the 15-digit Luhn
  checksum in the browser and stays free of DOM and framework imports, so the same check can run in
  a server route. Wiring a real lookup provider is the one place a backend is needed.
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

## Accessibility

Every text/background pair clears 4.5:1 in both themes, checked against the surface each one
actually sits on. `--faint` is the single exception and is decorative only — placeholders and window
chrome, never copy a reader needs. White on amber is 3.1:1, so a filled amber button carries ink
instead; that is what `--on-accent` is for.

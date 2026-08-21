# Openline — unlock service site

A static marketing site for a device-identity and unlock service, built on the design system
captured in the **Website design patterns** Cowork session.

The session produced a design canvas (`BaseIMEI Design System`) with five artboards: foundations,
component anatomy in light and dark, section patterns, and a rules/transfer sheet. That canvas
documents a third-party page, so what is carried into this repo is the **system** — the ratios, the
rhythm, the component anatomy — while the palette, the type and the marks are our own. The transfer
is written out in `docs/design-system.md` and rendered live at `design-system.html`.

## Layout

```
index.html            Homepage — the ten section patterns, in order
design-system.html    Living style guide: tokens, ramp, components, patterns, rules
assets/css/tokens.css Every colour, radius, shadow and geometry value. Light + one dark block.
assets/css/base.css   Reset, type ramp, shell and section rhythm
assets/css/components.css  Component anatomy — buttons, cards, band, FAQ, footer …
assets/css/docs.css   Chrome for the style guide only, not part of the product surface
assets/fonts/         Self-hosted Bricolage Grotesque + Instrument Sans (OFL 1.1)
assets/js/site.js     Theme toggle, mobile nav, local IMEI checksum validation
docs/design-system.md The written system: principles, tokens, patterns, transfer table
docs/reference/       The original canvas artboards, preserved as provenance
```

No build step and no dependencies. Open `index.html`, or serve the folder:

```sh
python3 -m http.server 8000
```

The page makes no external request: both faces are served from `assets/fonts/`, and every icon is an
inline SVG.

## Conventions

- **Tokens are the only place a colour is written.** No component hard-codes a hex.
- **Dark mode is one block.** `:root[data-theme='dark']` redefines the same names, re-pitched per
  role rather than inverted. A small inline script in each page head stamps the attribute before
  first paint so a dark reload never flashes white.
- **Geometry is not brand.** Radii, control heights, border weights and shadow spreads come from the
  captured system unchanged; changing the palette should never require touching them.
- **The IMEI field never phones home on keystroke.** It validates the 15-digit Luhn checksum in the
  browser. Wiring a real lookup provider is the one place a backend is needed.

## Re-skinning

Palette, type and marks are the parts that are ours rather than the captured system's, so they are
the parts meant to change. To re-skin: edit the palette and `--font-*` blocks in
`assets/css/tokens.css`, drop replacement faces into `assets/fonts/`, and swap the shield glyph in
the `.brand .mark` lockup. Nothing in `components.css` needs to change — its radii, control heights
and shadow spreads are the transferred geometry.

The brand name **Openline** is the one the design canvas already used for this swap; it appears in
page copy, the `<title>`, and the footer.

## Accessibility

Every text/background pair clears 4.5:1 in both themes, checked against the surface each one
actually sits on. `--faint` is the single exception and is decorative only — placeholders and window
chrome, never copy a reader needs. White on amber is 3.1:1, so a filled amber button carries ink
instead; that is what `--on-accent` is for.

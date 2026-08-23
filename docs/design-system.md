# iUnlockMobile design system

Transferred from the design canvas captured in the **Website design patterns** session. The canvas
documents a third-party page; what travels here is the system — the ratios, the rhythm, the
component anatomy — while the palette, the type and the marks are ours.

The live version of this document is the `/design-system` route, where every specimen renders from the
real tokens and follows the theme toggle.

---

## 1. Six decisions that do the work

Copying hex values gets you a palette, not the feel.

1. **Hairlines, never heavy borders.** Every edge is 1px and always one of two values. Structure is
   drawn with the lightest possible line, then separated by whitespace.
2. **Big radii, small padding ratio.** Cards run to radius 26 with 30px padding — the corner is
   nearly as large as the inset. Drop the radius to 8 and it becomes an ordinary dashboard.
3. **One shadow, very wide and very soft.** A 40px blur at 8%, tinted with the ink colour rather than
   black. It reads as ambient light, not elevation. No ramp: this one or the 80px version.
4. **Headlines are huge and tracked tight.** −0.058em at the hero with line-height 0.98, and the
   negative tracking scales down with the size to nothing at body.
5. **Colour is rationed.** Long stretches of near-white, then one saturated moment. The moss hue
   appears only as a small uppercase kicker — never as a fill.
6. **Whites are tinted, blacks are not black.** Surfaces carry a warm cast; the darkest ink is
   `#14241B`. Nothing is `#000` or a neutral grey, so the page sits in one temperature.

---

## 2. Tokens

All in `styles/tokens.css`. Light on `:root`; dark redefines the same names once under
`:root[data-theme='dark']`, re-pitched per role rather than inverted.

### Surfaces and ink

| Token | Light | Dark |
| --- | --- | --- |
| `--page` | `#FFFFFF` | `#0E1310` |
| `--page-soft` | `#F8F7F3` | `#121814` |
| `--page-tint` | `#F1EFE6` | `#18201A` |
| `--numeral` | `#F1EFE6` | `#26312A` |
| `--surface` | `#FFFFFF` | `#161D18` |
| `--surface-strong` | `#FAF9F5` | `#1B231D` |
| `--line` | `#E4E2D9` | `#2A332C` |
| `--line-strong` | `#D2CFC2` | `#3F4B42` |
| `--faint` | `#79857E` | `#7D8C82` |
| `--muted` | `#68736A` | `#99A89D` |
| `--ink` | `#2F3D34` | `#DBE4DC` |
| `--ink-strong` | `#14241B` | `#F2F7F2` |

### Accents

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Primary (emerald) | `--primary` | `#0F7A52` | `#4CC08A` |
| Primary hover | `--primary-dark` | `#0B5F40` | `#6FD3A3` |
| Primary tint | `--primary-soft` | `#E6F2EA` | `#10301F` |
| Secondary (amber) | `--accent` | `#D97B1E` | `#EDA553` |
| Secondary hover | `--accent-dark` | `#B86211` | `#F4BB78` |
| Secondary tint | `--accent-soft` | `#FDF1E1` | `#362313` |
| Kicker (moss) | `--moss` | `#516F34` | `#A9C47A` |
| Kicker tint | `--moss-soft` | `#EEF3E2` | `#212B18` |
| Success | `--success` | `#16845D` | `#72D9AF` |
| Warning | `--warning` | `#B8640F` | `#F0BD67` |
| Danger | `--danger` | `#B03A2B` | `#E58A7C` |
| Label on emerald fill | `--on-primary` | `#FFFFFF` | `#0B1410` |
| Label on amber fill | `--on-accent` | `#14241B` | `#0B1410` |

White on amber is only 3.1:1, so a filled amber button carries ink in both themes — that is what
`--on-accent` exists for. Every other text pair clears 4.5:1 on the surface it sits on; `--faint` is
the one exception and is decorative only (placeholders, window chrome), never copy a reader needs.

Amber is the **second** action, never the first. Emerald and amber never both act as primary in the
same block.

### Depth

| Token | Light | Dark |
| --- | --- | --- |
| `--shadow-soft` | `0 14px 40px rgba(20,42,30,.08)` | `0 16px 40px rgba(0,0,0,.18)` |
| `--shadow` | `0 30px 80px rgba(16,38,26,.14)` | `0 30px 80px rgba(0,0,0,.34)` |
| button | `0 13px 30px` at 20% of the button's own hue | black at 32% |

### Geometry

| Token | Value |
| --- | --- |
| `--shell` | `1180px` |
| `--gutter` | `72px` → `40px` (≤1080) → `22px` (≤620) |
| `--section` | `104px` → `88px` → `68px` |
| radii | 11 · 13 · 14 chips/buttons · 16 floats/tables · 22 panels · 24 FAQ · 26 cards · 28 bands · 40 device · 999 pills |

Do not round these to a 4/8px grid. `11`, `13`, `26`, `46`, `52` are real numbers here; snapping them
flattens the character.

### The one gradient

`--band` is `linear-gradient(120deg, #0D3B29 0%, #14573A 48%, #1A6C46 100%)` with a warm radial glow
at 83% 32%. It is identical in both themes and there is exactly **one band per page**. Content on it
uses `rgba(255,255,255,.06)` fills and `rgba(255,255,255,.14)` borders instead of tokens.

---

## 3. Type

`Bricolage Grotesque` for display, `Instrument Sans` for body.

| Role | Size / leading | Weight | Tracking |
| --- | --- | --- | --- |
| Hero H1 | clamp(38 → 68px) / 0.98 | 700 | −0.058em |
| Display H2 (band) | clamp(34 → 62px) / 1.04 | 620 | −0.048em |
| Section H2 | clamp(31 → 52px) / 1.08 | 680 | −0.045em |
| Card H3 | 20px / 1.35 | 680 | −0.025em |
| Lead | 19px / 1.7 `--muted` | 400 | — |
| Body | 16px / 1.65 `--ink` | 400 | — |
| Body small | 15px / 1.65 `--muted` | 400 | — |
| Nav / link | 13px | 620 | — |
| Kicker | 11px uppercase `--moss` | 740 | +0.09em |
| Eyebrow pill | 11px uppercase | 720 | +0.045em |
| Micro caption | 9px uppercase `--faint` | 700 | +0.14em |

Body copy sits in `--muted`; only headings earn the strong ink.

---

## 4. Components

Class names live in `styles/components.css`.

| Class | Anatomy |
| --- | --- |
| `.button--quiet` | `--surface`, 1px `--line`, radius 14, min-height 46, pad 10/17, 13px w680, no shadow |
| `.button--accent` | `--accent` fill, radius 14, min-height 46, shadow at 20% of its own hue |
| `.button--primary` | `--primary` fill, radius 14, **min-height 52**, pad 10/21 — the only 52px control |
| `.icon-action` | 40×40, radius 13, 1px `--line`, glyph 17px |
| `.eyebrow` | pill 999, pad 7/10, moss on `--moss-soft`, 1px tinted border |
| `.kicker` | 11px w740 +0.09em uppercase, moss, icon 14px, gap 7, no background |
| `.icon-tile` | 68×68, radius 22, glyph 28px line-style, tint by category, no border or shadow |
| `.card` | radius 26, pad 30, 1px `--line`, `--shadow-soft` |
| `.card--benefit` | min-height 310 so ragged copy never breaks the row; ends with an 11px link |
| `.card--step` | giant numeral, 68px w800, tinted `--numeral` so it reads as texture |
| `.float-card` | radius 16, pad 12/13, 92% surface + blur |
| `.mini-stat` | radius 11, pad 11, flat |
| `.trust-bar` | one panel, radius 22, equal columns divided by hairlines — not separate cards |
| `.field` | radius 14, min-height 50, mono value at +0.06em, 11px uppercase label |
| `.data-table` | 10px uppercase head on `--surface-strong`, mono identifiers masked to first 2 + last 4 |
| `.faq-item` | radius 24, pad 18/22, 26×26 toggle on `--primary-soft`, rotated 45° when open |
| `.cta` | contained panel, radius 28, pad 40/44 on `--primary-soft` with a moss radial |

The icon tint is the category signal: emerald = identity, amber = accounts and locks, moss =
delivery. Same box, same glyph weight; only the pairing changes.

---

## 5. Section patterns

A page is assembled from these ten blocks, in this order.

| # | Block | Notes |
| --- | --- | --- |
| 01 | Sticky header, 74px | page colour at 88% + blur, 1px bottom hairline, nav gap 28, actions toggle → quiet → accent |
| 02 | Hero, min-height 620 | 1.15fr / 0.85fr, gap 80, pad-top 78; second headline line in `--primary`; two low-opacity radial washes, never a linear gradient |
| 03 | Trust bar | one panel under the hero with no section padding above it |
| 04 | Benefit grid | 3 × card, gap 28, min-height 310 |
| 05 | Steps | numerals as texture; the one centred section head |
| 06 | Gradient band | full-bleed, the only 62px headline, glass panel on gradient |
| 07 | Product split | browser mock with a phone frame overlapping its lower-right corner |
| 08 | FAQ | 407 / 702, gap 70; first row open by default |
| 09 | CTA band | contained panel, not full-bleed |
| 10 | Footer | ground `#0D2018`, its own value; pad 65/26, column heads 12px +0.10em |

Sections alternate `--page` and `--page-soft`. The gradient band and the footer are the only
full-bleed colour breaks.

---

## 6. Transfer record

What was kept from the captured system, and what was replaced to make it ours.

| Kept | Replaced |
| --- | --- |
| 1px hairlines, radius 11–28, one wide soft shadow | Nothing — geometry is craft, not brand |
| Constant section padding, 1180px shell, kicker → headline → lead | Padding tuned to 104px, fluid gutter across three breakpoints |
| Tinted whites, ink that is never black | Cast moved cool teal → warm: `#F8F7F3` instead of `#F5FAFA` |
| One primary, one secondary, rationed accents | Blue + coral → emerald `#0F7A52` + amber `#D97B1E`, moss for kickers |
| Display face over a plainer body face, tight tracking at scale | Google Sans Flex → Bricolage Grotesque + Instrument Sans |
| Full dark theme from one token block | Same mechanism, own values — green-black instead of teal-black |

Source artboards are preserved in `docs/reference/`. They are reference material measured from a
third-party page on 21 Aug 2026 and are current as of that date only.

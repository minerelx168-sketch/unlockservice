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
5. **Colour is rationed.** Long stretches of near-white, then one saturated moment. The slate hue
   appears only as a small uppercase kicker — never as a fill.
6. **Whites are tinted, blacks are not black.** Surfaces carry a warm cast; the darkest ink is
   `#14241B`. Nothing is `#000` or a neutral grey, so the page sits in one temperature.

---

## 2. Tokens

All in `styles/tokens.css`. Light on `:root`; dark redefines the same names once under
`:root[data-theme='dark']`, re-pitched per role rather than inverted.

### Surfaces and ink

Values live on the `--color-*` names; the names below are what the components
were written in and resolve to them, so a palette change is one block in
`styles/tokens.css` and nothing in `components.css` moves.

| Token | Palette name | Light | Dark |
| --- | --- | --- | --- |
| `--page` | `--color-bg` | `#F4F6FA` | `#0C1219` |
| `--page-soft` | `--color-bg-soft` | `#EEF2F8` | `#101820` |
| `--page-tint` | `--color-bg-tint` | `#E4EAF3` | `#1D2833` |
| `--numeral` | `--color-bg-tint` | `#E4EAF3` | `#1D2833` |
| `--surface` | `--color-surface` | `#FFFFFF` | `#12181F` |
| `--surface-strong` | `--color-surface-elevated` | `#F8FAFC` | `#171F28` |
| `--line` | `--color-border` | `#DDE3EC` | `#232C36` |
| `--line-strong` | `--color-border-strong` | `#C3CCDA` | `#38434F` |
| — | `--color-border-control` | `#7C8BA3` | `#647280` |
| `--faint` | `--color-text-faint` | `#7B8AA0` | `#7C8EA4` |
| `--muted` | `--color-text-muted` | `#55647A` | `#9FB0C4` |
| `--ink` | `--color-text-body` | `#26364A` | `#CBD7E4` |
| `--ink-strong` | `--color-text` | `#0E1A2B` | `#E6EDF6` |

`--line` is a hairline between panels and is decorative, so it may be quiet.
`--color-border-control` is the edge of something you type into, which WCAG
2.2 counts as a non-text component and holds to 3:1 — it is visibly darker
for that reason, not by accident.

### Accents

| Role | Token | Light | Dark | On surface |
| --- | --- | --- | --- | --- |
| Primary (signal blue) | `--primary` | `#1A4FD6` | `#5B9BFF` | 6.70 / 8.26 |
| Primary hover | `--primary-dark` | `#143FAD` | `#7FB2FF` | — |
| Primary tint | `--primary-soft` | `#E8EEFC` | `#12233D` | — |
| Secondary (teal) | `--accent` | `#00707F` | `#4FD8F0` | 5.79 / — |
| Secondary hover | `--accent-dark` | `#005A66` | `#86E6F7` | — |
| Secondary tint | `--accent-soft` | `#E2F3F6` | `#0D2A30` | — |
| Kicker (slate) | `--moss` | `#33507A` | `#9DB8DD` | 8.17 / — |
| Kicker tint | `--moss-soft` | `#EAEFF7` | `#182432` | — |
| Band and footer ground | `--color-brand-secondary` | `#0B1F3A` | `#0B1F3A` | white 16.52 |
| Success | `--success` | `#0E7A4B` | `#4FD39B` | 5.38 / 9.46 |
| Warning | `--warning` | `#8A4B00` | `#F0B95C` | 6.80 / 10.03 |
| Danger | `--danger` | `#B3261E` | `#F08C7F` | 6.54 / 7.45 |
| Focus ring | `--color-focus` | `#1A4FD6` | `#7FB2FF` | 6.19 / 8.70 |
| Label on primary fill | `--on-primary` | `#FFFFFF` | `#08121F` | 6.70 / 6.79 |
| Label on secondary fill | `--on-accent` | `#FFFFFF` | `#04191D` | 5.79 / 10.68 |

Every text pair clears 4.5:1 against the surface it actually sits on rather
than against white, and every control edge and the focus ring clear 3:1.
`--faint` is the one exception and is decorative only — placeholders and
window chrome, never copy a reader needs.

Teal is the **second** action, never the first, and never a large field: it
belongs to kickers, underlines and the one secondary button in a block. The
navy is a ground, not a button. Success, warning and danger are far enough
from all three that a state is never read as a brand colour.

The focus ring is **two rings** — the page ground, then the focus colour —
because a single ring in the brand colour disappears on a button filled with
that same colour, which is the primary action on every page.

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
| Kicker | 11px uppercase `--moss` (slate) | 740 | +0.09em |
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
| `.eyebrow` | pill 999, pad 7/10, slate on `--moss-soft`, 1px tinted border |
| `.kicker` | 11px w740 +0.09em uppercase, slate, icon 14px, gap 7, no background |
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
| `.cta` | contained panel, radius 28, pad 40/44 on `--primary-soft` with a slate radial |

The icon tint is the category signal: blue = identity, teal = accounts and locks, slate =
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
| One primary, one secondary, rationed accents | Blue + coral → signal blue `#1A4FD6` + teal `#00707F`, slate for kickers, navy `#0B1F3A` for the band |
| Display face over a plainer body face, tight tracking at scale | Google Sans Flex → Bricolage Grotesque + Instrument Sans |
| Full dark theme from one token block | Same mechanism, own values — green-black instead of teal-black |

Source artboards are preserved in `docs/reference/`. They are reference material measured from a
third-party page on 21 Aug 2026 and are current as of that date only.

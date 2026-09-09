# Mobile homepage card fix — 7 September 2026

## Reproduced on the live website

At a 440 × 956 CSS-pixel viewport, `https://iunlockmobile.com/` rendered the service cards in three columns and the trust bar in four. The first card had only **51px of paragraph width** and was about **927px tall**. The document did not overflow horizontally, so an overflow-only check could not detect the readability failure shown in the customer's screenshots.

The live stylesheet `/_next/static/css/20d20c72fdd24bab.css` had a breakpoint gap: the grids collapsed at 380px and below, but stayed at their desktop column counts between 381px and 620px. The live page also served older copy than the current `main`. This confirms a serving/version mismatch, but does not establish the server's exact Git commit.

## Changes

- Import `styles/responsive-marketing.css` last, after existing layout rules.
- Size service columns by their available space, with an 18rem minimum card width and a one-column fallback. This prevents narrow text columns independently of the old breakpoints.
- Use one trust column below 24rem, two below 68rem, and four on wider screens. Theme-aware grid gaps provide consistent dividers.
- On phones, align a 48px icon beside the heading and let the paragraph and action span the full card width. Use 16px paragraph text, 20px headings, 20px padding, and actions at least 44px high.

This change modifies CSS only. The same two CSS files can be reviewed separately from the broader checkout/backend work on `main`.

## Validation

Production build on localhost, using a separate local database and paused ordering. Browser measurements from the Codex in-app browser:

| Viewport | Service columns | Trust columns | First-card paragraph width | Horizontal document overflow |
|---|---:|---:|---:|---|
| 320 × 800 | 1 | 1 | 234px | No |
| 375 × 812 | 1 | 1 | 289px | No |
| 381 × 812 | 1 | 1 | 295px | No |
| 390 × 844 | 1 | 2 | 304px | No |
| 430 × 932 | 1 | 2 | 344px | No |
| 440 × 956 | 1 | 2 | 354px | No |
| 620 × 900 | 1 | 2 | 534px | No |
| 621 × 900 | 1 | 2 | 499px | No |
| 640 × 900 | 1 | 2 | 518px | No |
| 768 × 1024 | 2 | 2 | 274px | No |
| 844 × 390 | 2 | 2 | 312px | No |
| 1024 × 768 | 3 | 2 | 239px | No |
| 1440 × 1000 | 3 | 4 | 265px | No |

At 440px, the first card is now about 235px tall with a 44px action. Card-height comparisons also reflect the shorter copy already present on `main`; the width/column correction is the CSS change.

Visually inspected the mobile service cards, the trust bar in dark mode, tablet cards, and desktop cards. Checked the shared trust bar on `/services/imei-check` at 320, 440, 768 and 1440px; all fit without document overflow. `npm run build`, `npm run lint`, and `git diff --check` passed.

Screenshots: [mobile service cards](screenshots/mobile-fix-services-440.png), [tablet service cards](screenshots/mobile-fix-services-tablet.png).

These are browser viewport checks, not tests on physical iPhones or all Safari versions. No payment or provider request was made.

## Live deployment status at the time of testing

The live site still serves the older stylesheet. The workflow listens for pushes to `claude/website-design-patterns-5043ix`, not `main`, and requires deployment variables. The repository Actions variable list returned HTTP 200 with no variables; the production environment variable endpoint returned 404. SSH to the host recorded in `deploy/README.md` timed out, so server state could not be verified or updated. Pushing this fix to `main` alone does not establish that it is live.

# Source documents

What the two Cowork sessions produced, kept here so the work survives the sessions.

## Design

The five `.dc.html` files plus `canvas.json` are the design canvas from the **Website design
patterns** session, extracted from the published artifact `BaseIMEI Design System`.

| File | Artboard |
| --- | --- |
| `Main.dc.html` | Foundations — colour tokens light and dark, type ramp, shape/depth/layout |
| `Components.dc.html` | Component anatomy, light |
| `ComponentsDark.dc.html` | Component anatomy, dark |
| `Patterns.dc.html` | Section patterns — the ten blocks a page is assembled from |
| `Rules.dc.html` | Rules and transfer — what actually makes the system work |
| `canvas.json` | Artboard positions and the canvas annotations |

They reference a `./support.js` provided by the canvas editor and are not meant to be opened
directly in a browser; read them as source, or open the artifact.

## Backend

`baseimei-backend-flow.md` is the architecture reference from the **Baseimei.com backend flow**
session: routes, the two-endpoint check contract, the hold → charge/refund credit model, the
invoice flow, an inferred schema, and the 38-service catalog with prices.

## What these are

Both were **observed from the client side** of a third-party site (baseimei.com, 21 Aug 2026) with
no access to its source. The backend document marks every inference with 🔶 and lists what it could
not verify in its own appendix B.

They are reference material, not assets to ship. Reuse the ratios, the rhythm and the flows; keep
palette, type, marks and code your own — which is what this repo does.

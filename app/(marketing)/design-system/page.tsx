import type { Metadata } from 'next'
import Link from 'next/link'
import { ImeiFieldSpecimen } from './specimens'
import { Icon, type IconName } from '@/components/icons'
import '@/styles/docs.css'

export const metadata: Metadata = {
  title: 'Design system',
  description:
    'The tokens, type ramp, component anatomy and section patterns behind the iUnlockMobile site — transferred from the design canvas captured in the Website design patterns session.',
}

const SWATCHES = [
  ['--page', '#FFFFFF', '#07111E'],
  ['--page-soft', '#F6F9FD', '#0B1828'],
  ['--page-tint', '#EDF4FC', '#10243A'],
  ['--surface-strong', '#F8FBFF', '#12243A'],
  ['--line', '#DCE5EF', '#22374D'],
  ['--line-strong', '#C2D0DF', '#3A536D'],
  ['--faint', '#718399', '#748AA1'],
  ['--muted', '#5E7186', '#9BB0C5'],
  ['--ink', '#2B3F55', '#DCE8F5'],
  ['--ink-strong', '#0C223A', '#F4F8FC'],
  ['--primary', '#0057B8', '#5BB5FF'],
  ['--primary-dark', '#003F87', '#8ACBFF'],
  ['--primary-soft', '#E8F2FF', '#0C2E52'],
  ['--accent', '#1B76D1', '#49A7F5'],
  ['--accent-soft', '#EAF5FF', '#102C48'],
  ['--moss', '#315E8A', '#85B9E8'],
  ['--moss-soft', '#EAF1F8', '#132A40'],
  ['--success', '#16845D', '#72D9AF'],
  ['--danger', '#B03A2B', '#E58A7C'],
  ['--band', '#021D3A', '#0759A8'],
  ['--numeral', '#EDF4FC', '#19344F'],
  ['--on-accent', '#FFFFFF', '#06182A'],
] as const

const PATTERNS: Array<[string, string]> = [
  [
    '01 · Sticky header — 74px',
    'Translucent page colour at 88% + backdrop blur, 1px bottom hairline. Nav gap 28, header gap 24. Actions read theme toggle → quiet account → Signal Blue catalog CTA.',
  ],
  [
    '02 · Hero — min-height 620',
    'Two columns 1.15fr / 0.85fr, gap 80, padding 78 top. Headline breaks across two lines with the second in --primary. Backdrop is two very low-opacity radial washes — never a linear gradient.',
  ],
  [
    '03 · Trust bar',
    'One panel, radius 22, divided by hairlines. Sits directly under the hero with no section padding above it.',
  ],
  [
    '04 · Benefit grid — 3 × card, gap 28',
    'Cards are min-height 310 so ragged copy never breaks the row. Each carries a different icon tint and ends with an 11px link.',
  ],
  [
    '05 · Steps',
    'The numeral is the decoration: 68px, weight 800, tinted to --numeral so it reads as texture. Section head is centred here, left-aligned everywhere else.',
  ],
  [
    '06 · Gradient band — full bleed',
    'The one saturated block, and the only place the headline goes to 62px / weight 620. The panel inside is glass on gradient, not a solid card.',
  ],
  [
    '07 · Product split',
    'A browser-chrome mock with a phone frame overlapping its lower-right corner — the overlap is what stops it reading as a flat screenshot.',
  ],
  [
    '08 · FAQ — 407 / 702, gap 70',
    'Asymmetric: a narrow intro column against a wide list. The first row opens by default.',
  ],
  [
    '09 · CTA band — radius 28',
    'Not full-bleed — a contained panel on --primary-soft with a tinted border, padding 40/44, plus a moss radial from the top-right corner.',
  ],
  [
    '10 · Footer — margin-top 100',
    'Ground is #0D2018, its own value rather than a surface token. Padding 65 top / 26 bottom, column heads 12px uppercase at +.10em, links 13.5px.',
  ],
]

const PRINCIPLES: Array<[string, string]> = [
  [
    'Hairlines, never heavy borders',
    'Every edge is 1px and always one of two values. Structure is drawn with the lightest possible line and then separated by whitespace — which is why a dense page still reads as calm.',
  ],
  [
    'Big radii, small padding ratio',
    'Cards run to radius 26 with 30px padding — the corner is nearly as large as the inset. Drop the radius to 8 and it becomes an ordinary dashboard.',
  ],
  [
    'One shadow, very wide and very soft',
    'A 40px blur at 8% opacity, tinted with the ink colour rather than pure black. It reads as ambient light, not elevation. There is no ramp — panels take this one or the 80px version, nothing between.',
  ],
  [
    'Headlines are huge and tracked tight',
    'The hero runs at −0.032em with line-height 1.02, and the tracking relaxes to nothing by body size. Tight enough to look drawn rather than typed; loose enough that a 15px label does not run together.',
  ],
  [
    'Colour is rationed',
    'Long stretches of blue-white, then one saturated moment: a Signal Blue CTA, an Azure outline action, and one deep-blue gradient band. Accents remain load-bearing because they are deliberately rare.',
  ],
  [
    'Whites are tinted, blacks are not black',
    'Surfaces carry a crisp blue-white cast and the darkest text is #0C223A. Nothing is pure black, so the interface stays inside one Signal Blue temperature.',
  ],
]

const KEEP = [
  'One shell width and one gutter for every page — 1180 / 72.',
  'Section padding as a constant, not a per-section judgement call.',
  'Kicker → headline → lead, in that order, at the top of every block.',
  'Body copy in --muted; only headings earn the strong ink.',
  'Line-style icons on one grid, in a tinted rounded square.',
  'Every token redefined once under a single dark-theme selector.',
]

const WRONG = [
  'Rounding the values to a 4/8px grid. 11, 13, 26, 46, 52 are real numbers here — snapping them flattens the character.',
  'Adding a second gradient. One band per page is the budget.',
  'Using two filled brand buttons in the same block — Signal Blue is primary, outline blue is secondary, and quiet is tertiary.',
  'Letting card copy set the row height. min-height is what keeps the grids honest.',
  'Inverting the palette for dark mode instead of re-pitching it per role.',
  'Keeping the 11px uppercase labels at that size on a phone without checking them on glass.',
]

const TRANSFER: Array<[string, string]> = [
  ['1px hairlines, radius 11–28, one wide soft shadow', 'Nothing — geometry is not brand, it is craft.'],
  [
    'Constant section padding, 1180px shell, kicker→headline→lead',
    'Padding tuned to 104px and a fluid gutter with three breakpoints.',
  ],
  ['Tinted whites, ink that is never black', 'Crisp blue-white #F6F9FD with blue-black #0C223A.'],
  [
    'One primary, one secondary, rationed accents',
    'Signal Blue #0057B8 + Azure #1B76D1, with Steel Blue for kickers and quiet emphasis.',
  ],
  [
    'Display face paired with a plainer body face, tight tracking at scale',
    'Google Sans Flex → Inter Tight for display, Inter for reading.',
  ],
  ['Full dark theme driven by one token block', 'Same mechanism, re-pitched as blue-black with a high-contrast light Signal Blue.'],
]

const BUTTON_SPECS: Array<{ className: string; icon: IconName; label: string; name: string; note: string }> = [
  {
    className: 'button button--quiet',
    icon: 'file',
    label: 'Secondary',
    name: '.button--quiet',
    note: 'bg --surface · 1px --line · radius 14 · min-h 46 · pad 10/17 · 13px w680 · gap 8 · no shadow',
  },
  {
    className: 'button button--accent',
    icon: 'grid',
    label: 'Secondary CTA',
    name: '.button--accent',
    note: 'bg --accent · radius 14 · min-h 46 · shadow 0 13px 30px rgba(217,123,30,.20) · the second action, never the first',
  },
  {
    className: 'button button--primary',
    icon: 'search',
    label: 'Primary CTA',
    name: '.button--primary',
    note: 'bg --primary · radius 14 · min-h 52 · pad 10/21 · the only 52px control on the page',
  },
]

const RAMP: Array<{ label: string; spec: string; sample: React.ReactNode }> = [
  {
    label: 'Hero H1',
    spec: 'clamp(38 → 68px) · lh 1.02 · ls −0.032em · w700 · 2nd line = --primary',
    sample: (
      <div className="t-hero" style={{ fontSize: 52 }}>
        Know the device
        <br />
        <span style={{ color: 'var(--primary)' }}>before you commit.</span>
      </div>
    ),
  },
  {
    label: 'Display H2 · band',
    spec: 'clamp(34 → 62px) · lh 1.08 · ls −0.028em · w640',
    sample: (
      <div className="t-display" style={{ fontSize: 40 }}>
        One workflow for the device details that matter.
      </div>
    ),
  },
  {
    label: 'Section H2',
    spec: 'clamp(30 → 50px) · lh 1.14 · ls −0.024em · w680',
    sample: (
      <div className="t-section" style={{ fontSize: 36 }}>
        Helpful answers before your first check.
      </div>
    ),
  },
  { label: 'Card H3', spec: '20px · lh 1.4 · ls −0.012em · w660', sample: <div className="t-card">Device identity checks</div> },
  {
    label: 'Lead',
    spec: '19 / 1.7 · w400 · --muted',
    sample: (
      <p className="t-lead">
        Check IMEI and serial details, carrier and SIM-lock state, blacklist status and activation
        locks.
      </p>
    ),
  },
  {
    label: 'Body',
    spec: '16 / 1.65 · w400 · --ink',
    sample: (
      <p className="t-body">
        Provider data is organised into readable results so buyers, repair teams and resellers find
        what matters quickly.
      </p>
    ),
  },
  {
    label: 'Body small',
    spec: '15 / 1.65 · w400 · --muted',
    sample: <p className="t-small">Return to completed results without exposing provider cost data.</p>,
  },
  {
    label: 'Nav / link',
    spec: '13px · w620 · active = 2px --moss underline',
    sample: (
      <div style={{ fontSize: 13, fontWeight: 620, color: 'var(--ink-strong)' }}>
        Services · How it works · FAQ
      </div>
    ),
  },
  {
    label: 'Section kicker',
    spec: '11px · w740 · +0.09em upper · --moss · icon 14px · gap 7',
    sample: <span className="kicker">Common questions</span>,
  },
  {
    label: 'Eyebrow pill',
    spec: '11px · w720 · +0.045em · pill 999 · pad 7/10',
    sample: <span className="eyebrow">Readable device reports</span>,
  },
  {
    label: 'Micro caption',
    spec: '11px · +0.1em upper · w650 · brand lockup & table heads',
    sample: <span className="t-micro">IMEI unlocking</span>,
  },
]

export default function DesignSystemPage() {
  return (
    <>
      <section className="doc-head">
        <div className="shell">
          <span className="kicker">
            <Icon name="shield" strokeWidth={2} />
            Design system · iUnlockMobile
          </span>
          <div style={{ height: 14 }} />
          <h1 className="t-hero" style={{ maxWidth: '14ch' }}>
            The system, not the skin.
          </h1>
          <div style={{ height: 20 }} />
          <p className="t-lead">
            Transferred from a design canvas captured in the <em>Website design patterns</em>{' '}
            session: the ratios, the rhythm and the component anatomy carried over, while the
            palette, the type and the marks are ours. Every value on this page is a live token —
            switch the theme and the specimens follow.
          </p>
        </div>
      </section>

      <section className="doc-section">
        <div className="shell">
          <div className="section-head">
            <span className="kicker">01 · Colour tokens</span>
            <h2 className="t-section">Blue-white surfaces, Signal Blue actions.</h2>
            <p className="t-lead">
              Surfaces carry a crisp blue-white cast, and the darkest ink is{' '}
              <code>#0C223A</code> — nothing on the page is pure black. Chips render the
              token for the theme you are in; hexes list light, then dark.
            </p>
          </div>

          <div className="swatch-grid">
            {SWATCHES.map(([name, light, dark]) => (
              <div className="swatch" key={name}>
                <div className="chip" style={{ background: `var(${name})` }} />
                <div className="meta">
                  <div className="nm">{name}</div>
                  <div className="hx">
                    {light} {name === '--band' ? '→' : '·'} {dark}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 20 }} />
          <p className="t-small">
            Dark is re-pitched per role, never inverted: Signal Blue lightens so it stays legible on
            blue-black, and the soft tints stop being pale washes and become deep chips behind a
            light glyph. Every text pair clears 4.5:1 on the surface it sits on;{' '}
            <code>--faint</code> is decorative only — placeholders and window chrome, never copy a
            reader needs.
          </p>
        </div>
      </section>

      <section className="doc-section">
        <div className="shell">
          <div className="section-head">
            <span className="kicker">02 · Type ramp</span>
            <h2 className="t-section">One superfamily, tracking that relaxes as it falls.</h2>
            <p className="t-lead">
              <strong>Inter Tight</strong> for display, <strong>Inter</strong> for reading —
              one superfamily, so a headline and the paragraph under it never disagree about
              proportion. Tracking is a function of size, not a house style: −0.032em at the
              hero, −0.024em at a section head, −0.012em on a card title, and none at all by
              the time the text is meant to be read rather than seen.
            </p>
          </div>

          {RAMP.map((row, index) => (
            <div className="ramp-row" key={row.label} style={index === 0 ? { borderTop: 0 } : undefined}>
              <div className="lbl">{row.label}</div>
              <div>{row.sample}</div>
              <div className="spec">{row.spec}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="doc-section">
        <div className="shell">
          <div className="section-head">
            <span className="kicker">03 · Component anatomy</span>
            <h2 className="t-section">Measured, not eyeballed.</h2>
            <p className="t-lead">
              Radii, control heights, border weights and shadow spreads — the part people usually
              guess at.
            </p>
          </div>

          <div className="doc-grid-3">
            {BUTTON_SPECS.map((spec) => (
              <div className="spec-card" key={spec.name}>
                <div className="stage">
                  <span className={spec.className}>
                    <Icon name={spec.icon} strokeWidth={1.9} />
                    {spec.label}
                  </span>
                </div>
                <div className="cap">
                  <b>{spec.name}</b>
                  <span>{spec.note}</span>
                </div>
              </div>
            ))}

            <div className="spec-card">
              <div className="stage">
                <span className="icon-action">
                  <Icon name="moon" />
                </span>
                <span className="icon-action">
                  <Icon name="menu" />
                </span>
              </div>
              <div className="cap">
                <b>.icon-action</b>
                <span>40×40 · radius 13 · 1px --line · bg --surface · glyph 17px</span>
              </div>
            </div>

            <div className="spec-card">
              <div className="stage">
                <span className="eyebrow">
                  <Icon name="shield" strokeWidth={2} />
                  Readable device reports
                </span>
              </div>
              <div className="cap">
                <b>.eyebrow</b>
                <span>
                  pill 999 · pad 7/10 · 11px w720 +.045em upper · --moss on --moss-soft · 1px tinted
                  border
                </span>
              </div>
            </div>

            <div className="spec-card">
              <div className="stage">
                <span className="kicker">
                  <Icon name="sparkle" strokeWidth={2} />
                  Common questions
                </span>
              </div>
              <div className="cap">
                <b>.kicker</b>
                <span>
                  11px w740 +.09em upper · --moss · icon 14 · gap 7 · no background. The moss hue
                  appears here and nowhere else.
                </span>
              </div>
            </div>
          </div>

          <div style={{ height: 18 }} />

          <div className="spec-card">
            <div className="stage" style={{ gap: 20 }}>
              <span className="icon-tile" aria-hidden="true">
                <Icon name="device" strokeWidth={1.7} />
              </span>
              <span className="icon-tile icon-tile--accent" aria-hidden="true">
                <Icon name="lock" strokeWidth={1.7} />
              </span>
              <span className="icon-tile icon-tile--moss" aria-hidden="true">
                <Icon name="bolt" strokeWidth={1.7} />
              </span>
              <span className="t-small" style={{ maxWidth: 340 }}>
                The tint is the category signal: Signal Blue = identity, Azure = supporting action,
                Steel Blue = quiet metadata. Same box, same glyph weight, only the pairing changes.
              </span>
            </div>
            <div className="cap">
              <b>.icon-tile</b>
              <span>
                68×68 · radius 22 · glyph 28px line-style · tints --primary-soft / --accent-soft /
                --moss-soft · no border, no shadow
              </span>
            </div>
          </div>

          <div style={{ height: 18 }} />

          <div className="doc-grid-2">
            <div className="spec-card">
              <div className="stage" style={{ alignItems: 'flex-start' }}>
                <article className="card card--benefit" style={{ width: 320, minHeight: 0 }}>
                  <span className="icon-tile" aria-hidden="true">
                    <Icon name="device" strokeWidth={1.7} />
                  </span>
                  <h4 className="t-card">Device identity checks</h4>
                  <p className="t-small">
                    Copy sits at 15px on a 1.65 leading, in --muted, never in the strong ink.
                  </p>
                  <Link className="link-arrow" href="/#check">
                    Start a lookup
                    <Icon name="arrowRight" strokeWidth={2.2} />
                  </Link>
                </article>
              </div>
              <div className="cap">
                <b>.card--benefit</b>
                <span>
                  radius 26 · pad 30 · 1px --line · --shadow-soft · min-h 310 in the grid · ends
                  with an 11px link, not a button
                </span>
              </div>
            </div>

            <div className="spec-card">
              <div className="stage" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
                <div className="float-card">
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon name="shield" />
                  </span>
                  <span>
                    <span className="label">Blacklist status</span>
                    <span className="value">Clean</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="mini-stat" style={{ width: 150 }}>
                    <span className="label">Identifier types</span>
                    <span className="value">IMEI · SN</span>
                  </div>
                  <div className="mini-stat" style={{ width: 150 }}>
                    <span className="label">Saved checks</span>
                    <span className="value">History</span>
                  </div>
                </div>
              </div>
              <div className="cap">
                <b>.float-card &amp; .mini-stat</b>
                <span>
                  float: radius 16 · pad 12/13 · gap 10 · 92% surface + blur · mini-stat: radius 11
                  · pad 11 · flat, no shadow
                </span>
              </div>
            </div>
          </div>

          <div style={{ height: 18 }} />

          <div className="spec-card">
            <div className="stage" style={{ padding: 26 }}>
              <div className="trust-bar">
                <div>
                  <b>IMEI + Serial</b>
                  <span>Flexible identifier checks</span>
                </div>
                <div>
                  <b>Apple + Android</b>
                  <span>Multiple device services</span>
                </div>
                <div>
                  <b>Worldwide</b>
                  <span>Built for global users</span>
                </div>
                <div>
                  <b>No cost data</b>
                  <span>Provider pricing stays hidden</span>
                </div>
              </div>
            </div>
            <div className="cap">
              <b>.trust-bar</b>
              <span>
                one panel, radius 22, equal columns divided by 1px hairlines — not four cards. Item
                pad 22/24 · headline 19px w700 · caption 12.5px --muted
              </span>
            </div>
          </div>

          <div style={{ height: 18 }} />

          <div className="doc-grid-2">
            <div className="spec-card">
              <div className="stage" style={{ padding: 26 }}>
                <details className="faq-item" open style={{ width: '100%' }}>
                  <summary>
                    What information can I check?
                    <span className="plus" aria-hidden="true">
                      <Icon name="plus" strokeWidth={2.6} />
                    </span>
                  </summary>
                  <div className="answer">
                    The first row opens by default so the pattern is legible without a click.
                  </div>
                </details>
              </div>
              <div className="cap">
                <b>.faq-item</b>
                <span>
                  radius 24 · pad 18/22 · summary 15px w700 --ink-strong · toggle 26×26 radius 8 on
                  --primary-soft, rotated 45° when open · rows gap 12
                </span>
              </div>
            </div>

            <ImeiFieldSpecimen />
          </div>

          <div style={{ height: 18 }} />

          <div className="spec-card">
            <div className="stage" style={{ padding: 26 }}>
              <div className="data-table" style={{ width: '100%' }}>
                <div className="row row--head">
                  <span>Identifier</span>
                  <span>Service</span>
                  <span>Status</span>
                </div>
                <div className="row">
                  <b>35······2145</b>
                  <span>Basic info</span>
                  <span className="status">Saved</span>
                </div>
                <div className="row">
                  <b>R5C····K2XV</b>
                  <span>Warranty</span>
                  <span className="status">Saved</span>
                </div>
              </div>
            </div>
            <div className="cap">
              <b>.data-table</b>
              <span>
                head 10px +.09em upper --muted on --surface-strong · rows divided by hairlines ·
                identifier in mono, masked to first 2 + last 4 · status in --success w700
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="doc-section">
        <div className="shell">
          <div className="section-head">
            <span className="kicker">04 · Section patterns</span>
            <h2 className="t-section">The page is ten repeated blocks.</h2>
            <p className="t-lead">
              Every screen is assembled from the same short vocabulary, and the order barely changes
              between pages.
            </p>
          </div>

          <table className="map">
            <thead>
              <tr>
                <th>Block</th>
                <th>What makes it work</th>
              </tr>
            </thead>
            <tbody>
              {PATTERNS.map(([block, note]) => (
                <tr key={block}>
                  <td>{block}</td>
                  <td>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="doc-section">
        <div className="shell">
          <div className="section-head">
            <span className="kicker">05 · Using this</span>
            <h2 className="t-section">What actually makes it work.</h2>
            <p className="t-lead">
              Copying hex values gets you a palette, not the feel. Six decisions do most of the
              work, and all six transfer to a completely different brand.
            </p>
          </div>

          {PRINCIPLES.map(([title, body], index) => (
            <div className="principle" key={title} style={index === 0 ? { borderTop: 0 } : undefined}>
              <span className="n">{index + 1}</span>
              <div>
                <h3 className="t-card">{title}</h3>
                <p>{body}</p>
              </div>
            </div>
          ))}

          <div style={{ height: 34 }} />

          <div className="doc-grid-2" style={{ gap: 20 }}>
            <div className="card">
              <h3 className="t-card">Keep these</h3>
              <ul className="tick tick--yes">
                {KEEP.map((item) => (
                  <li key={item}>
                    <Icon name="checkSmall" strokeWidth={2.2} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card card--quiet">
              <h3 className="t-card">Where it goes wrong</h3>
              <ul className="tick tick--no">
                {WRONG.map((item) => (
                  <li key={item}>
                    <Icon name="cross" strokeWidth={2.2} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ height: 34 }} />

          <div className="card">
            <span className="kicker">Transfer</span>
            <div style={{ height: 10 }} />
            <h3 className="t-card">Reusing the structure without borrowing the identity.</h3>
            <p className="t-small" style={{ marginTop: 8 }}>
              The canvas this came from documents a third-party site, so what travels is the{' '}
              <strong>system</strong> — the ratios, the rhythm, the component anatomy — while
              palette, type and marks stay ours. This build is exactly that swap.
            </p>
            <table className="map" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>What was kept</th>
                  <th>What was replaced</th>
                </tr>
              </thead>
              <tbody>
                {TRANSFER.map(([kept, replaced]) => (
                  <tr key={kept}>
                    <td>{kept}</td>
                    <td>{replaced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ height: 28 }} />
          <hr className="hairline" />
          <div style={{ height: 16 }} />
          <p className="t-small" style={{ fontSize: 12 }}>
            Source artboards are preserved in <code>docs/reference/</code>. They document
            measurements taken from a third-party page on 21 Aug 2026 and are reference material
            only — reuse the ratios and the rhythm, keep palette, type and marks your own.
          </p>
        </div>
      </section>
    </>
  )
}

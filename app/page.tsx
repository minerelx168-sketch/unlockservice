import Link from 'next/link'
import { ImeiForm } from '@/components/imei-form'
import { Icon, type IconName } from '@/components/icons'

const TRUST = [
  { title: 'IMEI + Serial', caption: 'Flexible identifier checks' },
  { title: 'Apple + Android', caption: 'Multiple device services' },
  { title: 'Worldwide', caption: 'Built for global users' },
  { title: 'No cost data', caption: 'Provider pricing stays hidden' },
]

/* The tint is the category signal: emerald = identity, amber = accounts
   and locks, moss = delivery. */
const SERVICES: Array<{
  icon: IconName
  tint: string
  title: string
  body: string
  action: { href: string; label: string }
}> = [
  {
    icon: 'device',
    tint: '',
    title: 'Device identity',
    body: 'Model, storage, colour, region and production window resolved from the identifier itself, so a listing can be checked against the hardware rather than the description.',
    action: { href: '#check', label: 'Start a lookup' },
  },
  {
    icon: 'lock',
    tint: ' icon-tile--accent',
    title: 'Accounts & locks',
    body: 'Activation lock, MDM enrolment, carrier and SIM-lock state, and whether the device has been reported lost or blocked on a network.',
    action: { href: '#check', label: 'Check lock state' },
  },
  {
    icon: 'bolt',
    tint: ' icon-tile--moss',
    title: 'Unlock delivery',
    body: 'Eligible devices move straight from the report into a request, and completed results stay in your history — readable later, without exposing provider cost data.',
    action: { href: '#how', label: 'See the flow' },
  },
]

const STEPS: Array<{ icon: IconName; tint: string; title: string; body: string }> = [
  {
    icon: 'keypad',
    tint: '',
    title: 'Enter an identifier',
    body: 'IMEI or serial. The checksum is validated in the browser first, so a mistyped digit never becomes a failed lookup.',
  },
  {
    icon: 'search',
    tint: ' icon-tile--accent',
    title: 'Pick the service',
    body: 'Identity, locks or unlock delivery. Each one states what it returns before you start, so there are no surprise fields in the result.',
  },
  {
    icon: 'check',
    tint: ' icon-tile--moss',
    title: 'Read the result',
    body: 'Provider data is reorganised into plain rows and kept in your history, so a report you ran last month is still readable today.',
  },
]

const BAND_ROWS: Array<{ icon: IconName; title: string; caption: string }> = [
  {
    icon: 'device',
    title: 'Hardware resolved',
    caption: 'Model, storage, region, production window',
  },
  {
    icon: 'lock',
    title: 'Locks surfaced',
    caption: 'Activation, MDM, carrier and SIM-lock state',
  },
  {
    icon: 'window',
    title: 'History kept',
    caption: 'Completed results stay readable, costs stay hidden',
  },
]

const RESULT_ROWS = [
  { identifier: '35······2145', service: 'Basic info' },
  { identifier: 'R5C····K2XV', service: 'Warranty' },
  { identifier: '86······7620', service: 'Blacklist' },
]

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'check',
    title: 'Plain-language status',
    body: 'Every field resolves to a word a customer can act on, not a provider code.',
  },
  {
    icon: 'shield',
    title: 'Masked identifiers',
    body: 'Full numbers are never displayed in shared views or exported summaries.',
  },
  {
    icon: 'clock',
    title: 'Results that keep',
    body: 'Return to a completed check later without re-running or re-paying for it.',
  },
]

const FAQ = [
  {
    question: 'What information can I check?',
    answer:
      'Device model and specification, carrier and SIM-lock state, blacklist reports, activation lock and MDM enrolment, and warranty window — subject to what each service covers for that manufacturer. Every service states its fields before you start.',
  },
  {
    question: 'Where do I find my IMEI?',
    answer:
      'Dial *#06# on the device — it works on both iOS and Android. The number is also printed on the SIM tray, on the original box, and shown in the settings app under the device’s About screen.',
  },
  {
    question: 'Is the IMEI I type sent anywhere?',
    answer:
      'Not while you are typing. The field validates the 15-digit checksum locally in your browser; nothing leaves the page until you submit a lookup. In results, identifiers are masked to the first two and last four digits.',
  },
  {
    question: 'Which devices are supported?',
    answer:
      'Apple and Android devices with a valid IMEI or serial number. Coverage differs per service and per network, so each one lists the manufacturers and regions it can answer for.',
  },
  {
    question: 'What happens after an unlock request?',
    answer:
      'The request keeps its own status in your history. When it completes, the result is written into the same report you started from, so the device’s identity check and its unlock live in one place.',
  },
]

export default function HomePage() {
  return (
    <>
      {/* 02 · Hero */}
      <section className="hero" id="check">
        <div className="shell">
          <div className="hero-copy">
            <span className="eyebrow">
              <Icon name="shield" strokeWidth={2} />
              Readable device reports
            </span>

            <h1 className="t-hero">
              Know the device
              <br />
              <span className="accent">before you commit.</span>
            </h1>

            <p className="t-lead">
              One identifier returns everything worth knowing: model and specification, carrier and
              SIM-lock state, blacklist and activation locks, warranty window. Then take the unlock
              from the same place you checked it.
            </p>

            <div className="hero-actions">
              <Link className="button button--primary" href="#how">
                <Icon name="search" strokeWidth={1.9} />
                See how a check runs
              </Link>
              <Link className="button button--quiet" href="#services">
                <Icon name="file" strokeWidth={1.9} />
                Browse services
              </Link>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-head">
              <span className="kicker">
                <Icon name="device" strokeWidth={2} />
                Start a lookup
              </span>
              <span className="t-micro">Checked in your browser</span>
            </div>

            <ImeiForm />

            <hr className="hairline" />

            <div className="hero-floats">
              <div className="float-card">
                <span className="icon-tile icon-tile--sm" aria-hidden="true">
                  <Icon name="shield" />
                </span>
                <span>
                  <span className="label">Blacklist status</span>
                  <span className="value">Reported per network</span>
                </span>
              </div>
              <div className="hero-mini">
                <div className="mini-stat">
                  <span className="label">Identifier types</span>
                  <span className="value">IMEI · SN</span>
                </div>
                <div className="mini-stat">
                  <span className="label">Result format</span>
                  <span className="value">Readable</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 03 · Trust bar */}
      <section className="section section--flush-top">
        <div className="shell">
          <div className="trust-bar">
            {TRUST.map((item) => (
              <div key={item.title}>
                <b>{item.title}</b>
                <span>{item.caption}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 · Benefit grid */}
      <section className="section section--tint" id="services">
        <div className="shell">
          <div className="section-head">
            <span className="kicker">
              <Icon name="sparkle" strokeWidth={2} />
              What you can check
            </span>
            <h2 className="t-section">Three questions, one workflow.</h2>
            <p className="t-lead">
              Buyers, repair benches, sellers and resellers all ask the same things in a different
              order. Each service answers one of them and returns the same shape of result.
            </p>
          </div>

          <div style={{ height: 44 }} />

          <div className="grid-3">
            {SERVICES.map((service) => (
              <article className="card card--benefit" key={service.title}>
                <span className={`icon-tile${service.tint}`} aria-hidden="true">
                  <Icon name={service.icon} strokeWidth={1.7} />
                </span>
                <h3 className="t-card">{service.title}</h3>
                <p className="t-small">{service.body}</p>
                <Link className="link-arrow" href={service.action.href}>
                  {service.action.label}
                  <Icon name="arrowRight" strokeWidth={2.2} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 05 · Steps */}
      <section className="section" id="how">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="pulse" strokeWidth={2} />
              How it works
            </span>
            <h2 className="t-section">Enter, check, act.</h2>
            <p className="t-lead">
              Every service follows the same three steps, whichever question you started with.
            </p>
          </div>

          <div style={{ height: 44 }} />

          <div className="grid-3">
            {STEPS.map((step, index) => (
              <article className="card card--step" key={step.title}>
                <span className="step-numeral" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={`icon-tile${step.tint}`} aria-hidden="true">
                  <Icon name={step.icon} strokeWidth={1.7} />
                </span>
                <h3 className="t-card" style={{ marginTop: 20 }}>
                  {step.title}
                </h3>
                <p className="t-small" style={{ marginTop: 9 }}>
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 06 · Gradient band — the one saturated block on the page */}
      <section className="section band">
        <div className="shell band-grid">
          <div className="stack" style={{ gap: 20 }}>
            <span className="kicker">
              <Icon name="shield" strokeWidth={2} />
              Overview
            </span>
            <h2 className="t-display">One workflow for the device details that matter.</h2>
            <p className="t-lead">
              Complex provider responses are normalised into the same readable structure every time,
              so a repair bench and a marketplace seller are reading the same report.
            </p>
          </div>

          <div className="band-panel">
            {BAND_ROWS.map((row) => (
              <div className="band-row" key={row.title}>
                <Icon name={row.icon} />
                <span>
                  <b>{row.title}</b>
                  <span>{row.caption}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 07 · Product split */}
      <section className="section">
        <div className="shell split">
          <div className="scene">
            <div className="window">
              <div className="window-bar">
                <i aria-hidden="true" />
                <i aria-hidden="true" />
                <i aria-hidden="true" />
                <span className="addr">openline / results</span>
              </div>
              <div className="window-body">
                <div className="data-table">
                  <div className="row row--head">
                    <span>Identifier</span>
                    <span>Service</span>
                    <span>Status</span>
                  </div>
                  {RESULT_ROWS.map((row) => (
                    <div className="row" key={row.identifier}>
                      <b>{row.identifier}</b>
                      <span>{row.service}</span>
                      <span className="status">Saved</span>
                    </div>
                  ))}
                </div>
                <div className="hero-mini">
                  <div className="mini-stat">
                    <span className="label">Saved reports</span>
                    <span className="value">History</span>
                  </div>
                  <div className="mini-stat">
                    <span className="label">Identifier shown</span>
                    <span className="value">Masked</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="device" aria-hidden="true">
              <div className="screen">
                <span className="t-micro">Openline</span>
                <div className="float-card" style={{ boxShadow: 'none' }}>
                  <span className="icon-tile icon-tile--sm">
                    <Icon name="check" />
                  </span>
                  <span>
                    <span className="label">SIM lock</span>
                    <span className="value">Unlocked</span>
                  </span>
                </div>
                <div className="mini-stat">
                  <span className="label">Blacklist</span>
                  <span className="value">Clean</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stack" style={{ gap: 24 }}>
            <span className="kicker">
              <Icon name="window" strokeWidth={2} />
              The result view
            </span>
            <h2 className="t-section">Readable on the bench, readable on a phone.</h2>
            <p className="t-lead">
              The same report renders in the dashboard and on the device in your hand — identifiers
              masked to the first two and last four digits, status in plain words.
            </p>

            <ul className="feature-list">
              {FEATURES.map((feature) => (
                <li key={feature.title}>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon name={feature.icon} />
                  </span>
                  <span>
                    <b>{feature.title}</b>
                    <span>{feature.body}</span>
                  </span>
                </li>
              ))}
            </ul>

            <Link className="button button--primary" href="#check" style={{ justifySelf: 'start' }}>
              <Icon name="search" strokeWidth={1.9} />
              Run your first check
            </Link>
          </div>
        </div>
      </section>

      {/* 08 · FAQ */}
      <section className="section section--tint" id="faq">
        <div className="shell faq">
          <div className="section-head">
            <span className="kicker">
              <Icon name="question" strokeWidth={2} />
              Common questions
            </span>
            <h2 className="t-section">Helpful answers before your first check.</h2>
            <p className="t-lead">
              If something here is still unclear, ask before you spend anything.
            </p>
          </div>

          <div className="faq-list">
            {FAQ.map((item, index) => (
              <details className="faq-item" key={item.question} open={index === 0}>
                <summary>
                  {item.question}
                  <span className="plus" aria-hidden="true">
                    <Icon name="plus" strokeWidth={2.6} />
                  </span>
                </summary>
                <div className="answer">{item.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 09 · CTA band */}
      <section className="section">
        <div className="shell">
          <div className="cta">
            <div className="stack" style={{ gap: 10 }}>
              <span className="kicker">
                <Icon name="bolt" strokeWidth={2} />
                Ready when you are
              </span>
              <h2 className="t-card" style={{ fontSize: 30, letterSpacing: '-0.035em' }}>
                Check a device before the money moves.
              </h2>
              <p className="t-small">
                One identifier is enough to start. No account needed to validate a number.
              </p>
            </div>
            <div className="cta-actions">
              <Link className="button button--primary" href="#check">
                Run a check
              </Link>
              <Link className="button button--quiet" href="/design-system">
                View the design system
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

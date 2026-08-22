import Link from 'next/link'
import { ImeiForm } from '@/components/imei-form'
import { Icon, type IconName } from '@/components/icons'

const TRUST = [
  { title: 'Permanent', caption: 'Survives updates and resets' },
  { title: 'Official route', caption: 'Filed with the carrier, not a hack' },
  { title: 'Any brand', caption: 'Apple, Samsung, Google and more' },
  { title: 'Refused? Refunded', caption: 'You pay for unlocks that land' },
]

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
    title: 'Network unlock',
    body: 'The device leaves its carrier for good. We file the request against the IMEI with the network that holds the lock — no cables, no jailbreak, no trip to a shop.',
    action: { href: '#how', label: 'See how it runs' },
  },
  {
    icon: 'lock',
    tint: ' icon-tile--accent',
    title: 'Locks left behind',
    body: 'An iCloud activation lock, a management profile from a company laptop fleet, a Google FRP screen after a reset — the locks that make a device you own unusable.',
    action: { href: '/login', label: 'Order a removal' },
  },
  {
    icon: 'search',
    tint: ' icon-tile--moss',
    title: 'Check before you buy',
    body: 'Which network a device is locked to, whether it has been reported lost, what the warranty says. A dollar to find out, before a purchase or an unlock order.',
    action: { href: '/login', label: 'Run a check' },
  },
]

const STEPS: Array<{ icon: IconName; tint: string; title: string; body: string }> = [
  {
    icon: 'keypad',
    tint: '',
    title: 'Give us the IMEI',
    body: 'Dial *#06# on the device. Pick the brand and the network it is locked to, and the price and turnaround appear before you commit to anything.',
  },
  {
    icon: 'bolt',
    tint: ' icon-tile--accent',
    title: 'We file the request',
    body: 'The order goes into the carrier or manufacturer database against that IMEI. Your credit is held, not spent, for as long as it sits with them.',
  },
  {
    icon: 'check',
    tint: ' icon-tile--moss',
    title: 'The unlock arrives',
    body: 'Apple devices are released remotely — connect to Wi-Fi and it is done. Everything else gets a code to enter when a new SIM goes in.',
  },
]

const BAND_ROWS: Array<{ icon: IconName; title: string; caption: string }> = [
  {
    icon: 'shield',
    title: 'Filed at the source',
    caption: 'The carrier or manufacturer that holds the lock, not a workaround',
  },
  {
    icon: 'clock',
    title: 'Tracked while it runs',
    caption: 'A live status per order, and the result by email',
  },
  {
    icon: 'window',
    title: 'Held, then charged',
    caption: 'Refused devices give the whole amount back',
  },
]

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'check',
    title: 'The code, front and centre',
    body: 'A delivered unlock puts the code where you cannot miss it, with what to do next in plain words.',
  },
  {
    icon: 'shield',
    title: 'Masked identifiers',
    body: 'Full IMEIs are never shown in lists or shared views — first two digits and last four only.',
  },
  {
    icon: 'clock',
    title: 'Orders that keep',
    body: 'A code from three months ago is still there, on the order you bought it with.',
  },
]

const FAQ = [
  {
    question: 'Is this permanent, and is my warranty safe?',
    answer:
      'Yes to both. The unlock is recorded against the IMEI in the carrier or manufacturer database, so it survives updates, resets and new SIMs. Nothing is installed on the device and no software is modified, which is what puts a warranty at risk.',
  },
  {
    question: 'How long does it take?',
    answer:
      'It depends on the network — some authorise within hours, others take a couple of days. The turnaround for your exact carrier is quoted before you order, and the order shows its live status until it lands.',
  },
  {
    question: 'What if my device cannot be unlocked?',
    answer:
      'You get every cent back. Your credit is held while the order is with the carrier and only becomes a charge once the unlock is delivered — so a device that is under contract, reported lost or blocked for unpaid bills costs you nothing.',
  },
  {
    question: 'Where do I find my IMEI?',
    answer:
      'Dial *#06# on the device — it works on iOS and Android. It is also printed on the SIM tray, on the original box, and shown in the settings app under the device’s About screen.',
  },
  {
    question: 'Do I have to send my phone anywhere?',
    answer:
      'No. Everything is done remotely against the IMEI. Apple devices are released over the air — connect to Wi-Fi and follow the prompt. Other brands receive a code you enter once, with a SIM from the new network in the device.',
  },
  {
    question: 'Can you unlock a phone that is still on contract?',
    answer:
      'Usually not, and we will not pretend otherwise. Carriers refuse devices with an unpaid balance, an active contract, or a lost-or-stolen report. The order comes back refused and your credit is returned in full.',
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
              Permanent IMEI unlocking
            </span>

            <h1 className="t-hero">
              Unlock the phone
              <br />
              <span className="accent">you already own.</span>
            </h1>

            <p className="t-lead">
              One IMEI is all it takes. We file the request with the network that holds the lock, and
              the device leaves that carrier for good — no cables, no jailbreak, nothing to install.
              If the carrier refuses, you pay nothing.
            </p>

            <div className="hero-actions">
              <Link className="button button--primary" href="#how">
                <Icon name="bolt" strokeWidth={1.9} />
                See how it works
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
                Start with the IMEI
              </span>
              <span className="t-micro">Checked in your browser</span>
            </div>

            <ImeiForm />

            <hr className="hairline" />

            <div className="hero-floats">
              <div className="float-card">
                <span className="icon-tile icon-tile--sm" aria-hidden="true">
                  <Icon name="check" />
                </span>
                <span>
                  <span className="label">After the unlock</span>
                  <span className="value">Any network, permanently</span>
                </span>
              </div>
              <div className="hero-mini">
                <div className="mini-stat">
                  <span className="label">Typical turnaround</span>
                  <span className="value">Hours</span>
                </div>
                <div className="mini-stat">
                  <span className="label">If refused</span>
                  <span className="value">Full refund</span>
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
              What we unlock
            </span>
            <h2 className="t-section">Three kinds of lock, one process.</h2>
            <p className="t-lead">
              A carrier lock, a lock somebody else left on the device, or the question of what is
              locked in the first place. Each one is priced up front and tracked the same way.
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
            <h2 className="t-section">IMEI in, unlock out.</h2>
            <p className="t-lead">
              Three steps, and the device never leaves your hand.
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
              Why it sticks
            </span>
            <h2 className="t-display">The lock is released where it was set.</h2>
            <p className="t-lead">
              A carrier lock lives in the network&rsquo;s own database, against your IMEI. That is
              where we file, which is why the unlock survives a factory reset and why nothing has to
              be installed on the phone.
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
                <span className="addr">openline / orders</span>
              </div>
              <div className="window-body">
                <div className="data-table">
                  <div className="row row--head">
                    <span>Device</span>
                    <span>Service</span>
                    <span>Status</span>
                  </div>
                  <div className="row">
                    <b>35······0095</b>
                    <span>AT&amp;T unlock</span>
                    <span className="status">Unlocked</span>
                  </div>
                  <div className="row">
                    <b>35······4471</b>
                    <span>O2 unlock</span>
                    <span className="status">Unlocked</span>
                  </div>
                  <div className="row">
                    <b>86······7620</b>
                    <span>MDM removal</span>
                    <span className="status">Unlocked</span>
                  </div>
                </div>
                <div className="hero-mini">
                  <div className="mini-stat">
                    <span className="label">Held for open orders</span>
                    <span className="value">$0.00</span>
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
                    <span className="label">Network</span>
                    <span className="value">Unlocked</span>
                  </span>
                </div>
                <div className="mini-stat">
                  <span className="label">Unlock code</span>
                  <span className="value">4187 2290</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stack" style={{ gap: 24 }}>
            <span className="kicker">
              <Icon name="window" strokeWidth={2} />
              The order view
            </span>
            <h2 className="t-section">Watch it run, then keep the result.</h2>
            <p className="t-lead">
              Every order shows where it is while the carrier has it, and what came back once they
              answer — the code, what to do with it, and whether the credit was charged or returned.
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

            <Link className="button button--primary" href="/register" style={{ justifySelf: 'start' }}>
              <Icon name="bolt" strokeWidth={1.9} />
              Unlock your first device
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
            <h2 className="t-section">Straight answers before you pay.</h2>
            <p className="t-lead">
              Including the one most unlock sites leave out — when it will not work.
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
                Take the lock off before you sell, travel or switch.
              </h2>
              <p className="t-small">
                Price and turnaround are quoted before you order, and a refused device costs nothing.
              </p>
            </div>
            <div className="cta-actions">
              <Link className="button button--primary" href="/register">
                Create an account
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

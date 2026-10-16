import Link from 'next/link'
import { Icon, type IconName } from '@/components/icons'
import { SupportSearch } from '@/components/support-search'
import { getArticle, listArticles } from '@/lib/articles'
import { FAQ } from '@/lib/faq'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata(
  '/support',
  'Help Centre',
  'Guides, answers and troubleshooting for phone unlocking, IMEI reports, payments and credit — and how to reach a person when you need one.',
)

type HubLink = { href: string; label: string }

/* Links are resolved against the guide catalog so a renamed article drops
   out of the hub instead of leaving a dead link. */
function guide(slug: string, label?: string): HubLink | null {
  const article = getArticle(slug)
  return article ? { href: `/articles/${article.slug}`, label: label ?? article.title } : null
}

function present(links: Array<HubLink | null>): HubLink[] {
  return links.filter((link): link is HubLink => link !== null)
}

export default function SupportPage() {
  const guides = listArticles().map((article) => ({ slug: article.slug, title: article.title, topic: article.topic }))

  const hubs: Array<{ icon: IconName; tint: string; title: string; lead: string; links: HubLink[]; cta: HubLink }> = [
    {
      icon: 'lock',
      tint: '',
      title: 'Unlocking',
      lead: 'Before, during and after a network unlock.',
      links: present([
        guide('network-unlock-explained', 'How unlocking works'),
        guide('how-long-does-iphone-carrier-unlock-take', 'How long it takes'),
        guide('iphone-unlocked-but-no-service-troubleshooting', 'Unlocked but no service'),
        guide('can-you-unlock-financed-iphone-before-payoff', 'Financed phones'),
      ]),
      cta: { href: '#unlock', label: 'Unlock troubleshooting' },
    },
    {
      icon: 'search',
      tint: ' icon-tile--accent',
      title: 'Phone Check reports',
      lead: 'What a report says and how to read it.',
      links: present([
        guide('what-an-imei-check-tells-you', 'What an IMEI check tells you'),
        guide('checks-before-buying-a-used-phone', 'Checks before buying used'),
        guide('blacklisted-iphone-unlock-carrier-lock-difference', 'Blacklist vs carrier lock'),
        guide('how-to-find-carrier-on-iphone-before-unlock', 'Finding the carrier'),
      ]),
      cta: { href: '/services/imei-check', label: 'Browse reports' },
    },
    {
      icon: 'wallet',
      tint: ' icon-tile--moss',
      title: 'Payments and credit',
      lead: 'Adding credit, holds, charges and refusals.',
      links: [
        { href: '#faq', label: 'How credit and holds work' },
        { href: '/terms#refunds', label: 'Refunds and refused orders' },
        { href: '/user/add-funds', label: 'Add credit (sign in)' },
        { href: '/user/payments', label: 'Payment history (sign in)' },
      ],
      cta: { href: '/contact', label: 'Ask about a payment' },
    },
  ]

  const topIssues = present([
    guide('iphone-sim-not-supported-after-switching-carriers', 'SIM not supported after unlock'),
    guide('iphone-unlocked-but-no-service-troubleshooting', 'Unlocked but no service'),
    guide('can-unlocked-iphone-be-locked-again', 'Phone appears locked again'),
    guide('iphone-dual-sim-two-carriers-unlock-guide', 'Dual SIM and eSIM after unlock'),
    guide('invalid-sim-iphone-carrier-lock-or-sim-failure', '“Invalid SIM”'),
    guide('how-to-unlock-esim-on-iphone', 'eSIM'),
  ])

  return (
    <>
      <section className="section section--tint support-hero">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="question" strokeWidth={2} />
              Help centre
            </span>
            <h1 className="t-section">How can we help?</h1>
            <p className="t-lead">Search the guides, read the common answers, or write to a person.</p>
          </div>
          <SupportSearch guides={guides} />
          <nav className="support-tabs" aria-label="Help sections">
            <a href="#guides"><Icon name="file" strokeWidth={2} />Guides</a>
            <a href="#unlock"><Icon name="lock" strokeWidth={2} />Unlock troubleshooting</a>
            <a href="#faq"><Icon name="question" strokeWidth={2} />Common questions</a>
          </nav>
        </div>
      </section>

      <section className="section home-section" id="guides">
        <div className="shell">
          <div className="section-head section-head--center">
            <h2 className="t-section">
              Get help with <span className="accent">your service.</span>
            </h2>
            <p className="t-lead">Quick routes into the guides, grouped the way the questions arrive.</p>
          </div>
          <div className="hub-grid support-hubs">
            {hubs.map((hub) => (
              <article className="support-hub" key={hub.title}>
                <span className={`icon-tile${hub.tint}`} aria-hidden="true">
                  <Icon name={hub.icon} strokeWidth={1.8} />
                </span>
                <h3>{hub.title}</h3>
                <p>{hub.lead}</p>
                <ul>
                  {hub.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
                <Link className="button button--secondary" href={hub.cta.href}>
                  {hub.cta.label}
                  <Icon name="arrowRight" strokeWidth={2.2} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint home-section" id="unlock">
        <div className="shell support-unlock">
          <nav className="service-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/support">Help centre</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Unlocking</span>
          </nav>
          <div className="support-title">
            <span className="icon-tile" aria-hidden="true">
              <Icon name="device" strokeWidth={1.7} />
            </span>
            <div>
              <h2 className="t-card" style={{ fontSize: 28, letterSpacing: '-0.03em' }}>Network unlocks</h2>
              <p className="t-small">Eligibility, tracking, and what to do when the new SIM does not work straight away.</p>
            </div>
          </div>

          <p className="callout callout--warn">
            <Icon name="info" strokeWidth={2} />
            <span>
              <b>The device must not be reported lost or stolen.</b> A Phone Check report shows the status
              before you order. Financed devices are usually accepted once the account is current.
            </span>
          </p>

          <div className="cta-actions support-actions">
            <Link className="button button--primary" href="/services/unlock">Start an unlock</Link>
            <Link className="button button--quiet" href="/services/imei-check">Check lock status</Link>
            <Link className="button button--quiet" href="/track">Track an order</Link>
          </div>

          {topIssues.length ? (
            <>
              <h3 className="support-h3">Top issues</h3>
              <div className="chip-row">
                {topIssues.map((issue) => (
                  <Link className="chip" href={issue.href} key={issue.href}>{issue.label}</Link>
                ))}
              </div>
            </>
          ) : null}

          <div className="support-cards">
            <div className="support-card">
              <h3>
                <Icon name="checkSmall" strokeWidth={2.4} />
                Quick pre-check
              </h3>
              <ul className="tick-list">
                <li>The order page says delivered, and the confirmation email arrived</li>
                <li>A SIM from the new network is in the phone, in the right size or as eSIM</li>
                <li>The SIM is seated properly and the phone has been restarted since</li>
                <li>The new line is active with the new network</li>
                <li>For a code unlock: the code was typed once, exactly as delivered</li>
              </ul>
            </div>
            <div className="support-card">
              <h3>
                <Icon name="globe" strokeWidth={2} />
                APN settings after an unlock
              </h3>
              <p>
                <b>iPhone:</b> Settings → Mobile Data → Mobile Data Network. <b>Android:</b> Settings →
                Network &amp; Internet → Mobile Network → Access Point Names.
              </p>
              <p>
                Most networks push these automatically. Set them by hand only if calls work but data does
                not, using the values from the new network, then restart.
              </p>
            </div>
            <div className="support-card">
              <h3>
                <Icon name="mail" strokeWidth={2} />
                Still need help?
              </h3>
              <p>Write to us with:</p>
              <ul className="dot-list">
                <li>the order number</li>
                <li>which of the steps above you have tried</li>
                <li>a screenshot of any message the phone shows</li>
              </ul>
              <Link className="button button--secondary" href="/contact">
                Contact support
                <Icon name="arrowRight" strokeWidth={2.2} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section home-section" id="faq">
        <div className="shell faq">
          <div className="section-head">
            <span className="kicker">
              <Icon name="question" strokeWidth={2} />
              Common questions
            </span>
            <h2 className="t-section">The answers most people need.</h2>
            <p className="t-lead">Credit, timing, warranties, and when an unlock will not work.</p>
          </div>
          <div>
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
            <p className="faq-foot">
              <Link className="link-arrow" href="/contact">
                Still have a question? Talk to support
                <Icon name="arrowRight" strokeWidth={2.2} />
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

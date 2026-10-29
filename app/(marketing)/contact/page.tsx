import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { ContactForm } from '@/components/contact-form'
import { Icon } from '@/components/icons'
import { currentSession } from '@/lib/auth'
import { supportEmail } from '@/lib/site'



export const dynamic = 'force-dynamic'

export const metadata = pageMetadata("/contact", "Contact iUnlockMobile Support", "Contact iUnlockMobile about phone unlocking, IMEI reports, payments or an existing order. Get help choosing a service before you pay.")

export default async function ContactPage() {
  const found = await currentSession()
  const support = supportEmail()

  return (
    <section className="section section--tint contact-page">
      <div className="shell">
        <nav className="service-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: 18 }}>
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/support">Help centre</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Contact</span>
        </nav>
        <div className="section-head" style={{ marginBottom: 26 }}>
          <span className="kicker">
            <Icon name="mail" strokeWidth={2} /> Contact
          </span>
          <h1 className="t-section">Talk to a person.</h1>
          <p className="t-lead">
            Questions about an order, a payment or a device? Write below or email us — it is the same inbox.
          </p>
        </div>

        <div className="contact-shortcuts">
          <Link className="hub-card" href="/track">
            <span className="icon-tile icon-tile--accent" aria-hidden="true"><Icon name="clock" strokeWidth={1.8} /></span>
            <h3>Where is my order?</h3>
            <p>The order page has the live status and the result. No message needed.</p>
            <span className="link-arrow">Track an order <Icon name="arrowRight" strokeWidth={2.2} /></span>
          </Link>
          <Link className="hub-card" href="/support">
            <span className="icon-tile icon-tile--moss" aria-hidden="true"><Icon name="question" strokeWidth={1.8} /></span>
            <h3>Help centre</h3>
            <p>Guides, troubleshooting after an unlock, and the questions everyone asks.</p>
            <span className="link-arrow">Open the help centre <Icon name="arrowRight" strokeWidth={2.2} /></span>
          </Link>
        </div>

        <div className="contact-grid">
          <ContactForm defaultEmail={found?.user.email ?? ''} />

          <div className="contact-facts">
            <div className="contact-fact">
              <span className="label">Email</span>
              <span className="value">
                <a href={`mailto:${support}`}>{support}</a>
              </span>
            </div>

            <div className="contact-fact">
              <span className="label">Answering hours</span>
              <span className="value">
                Every day. Most messages are answered within a day; an order that is already with
                the network can take longer to have news about than to reply to.
              </span>
            </div>

            <div className="contact-fact">
              <span className="label">Before you write about an order</span>
              <span className="value">
                The order page shows the current status. If we cannot deliver, direct card orders
                are refunded to the original payment method and balance-paid orders release their reserved credit.
                Crypto refunds need support review.{' '}
                {found ? (
                  <Link href="/user/orders">See your orders</Link>
                ) : (
                  <Link href="/login">Sign in to see your orders</Link>
                )}
                .
              </span>
            </div>

            <div className="contact-fact">
              <span className="label">What we cannot do</span>
              <span className="value">
                We cannot unlock a device reported lost or stolen, clear a finance agreement, or
                bypass an activation lock on a phone that is not yours. Asking will not change the
                answer, and we would rather say so here than take the money first.
              </span>
            </div>

            <div className="contact-fact">
              <span className="label">Never send</span>
              <span className="value">
                A password, a payment card number, or a wallet key. Nobody here will ask for one.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

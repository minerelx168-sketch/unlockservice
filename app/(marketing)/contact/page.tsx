import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactForm } from '@/components/contact-form'
import { Icon } from '@/components/icons'
import { currentSession } from '@/lib/auth'
import { supportEmail } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Send a message to iUnlockMobile support about an order, a payment, or a question before you buy.',
}

export const dynamic = 'force-dynamic'

export default async function ContactPage() {
  const found = await currentSession()
  const support = supportEmail()

  return (
    <section className="section section--tint">
      <div className="shell">
        <div className="section-head">
          <span className="kicker">
            <Icon name="info" strokeWidth={2} /> Contact
          </span>
          <h1 className="t-section">Talk to a person.</h1>
          <p className="t-lead">
            Questions about an order, a payment, or whether a device can be unlocked at all. Write
            below and it reaches the same inbox as an email to us — or write to that address
            directly, whichever you prefer.
          </p>
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
                The order page shows its live status, and a refused unlock returns the credit
                automatically — no message needed.{' '}
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

import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { CUSTOMER_PRODUCT_COUNTS } from '@/lib/customer-provider-products'

export const metadata: Metadata = {
  title: 'Unlock Service and Phone Check',
  description: 'Choose Phone Check or Unlock Service before browsing products, prices and availability.',
}

export default function ServicesPage() {
  return (
    <>
      <section className="section section--tint">
        <div className="shell">
          <div className="section-head">
            <span className="kicker"><Icon name="grid" /> Service categories</span>
            <h1 className="t-display">Choose what you need.</h1>
            <p className="t-lead">
              Phone checks and unlocking are different services. Select one category first so you only see relevant products, prices and next steps.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="service-hub-grid">
            <article className="card service-hub-card service-hub-card--checks">
              <div className="service-hub-icon"><Icon name="search" /></div>
              <div className="service-hub-copy">
                <span className="kicker">Device information</span>
                <h2>Phone Check</h2>
                <p>Check device, carrier, warranty, blacklist and lock-status information before buying, selling or unlocking a phone.</p>
              </div>
              <div className="service-hub-stats">
                <div><strong>{CUSTOMER_PRODUCT_COUNTS.imeiCheck}</strong><span>published checks</span></div>
                <div><strong>25</strong><span>available online</span></div>
              </div>
              <div className="service-hub-actions">
                <Link className="button button--primary" href="/services/imei-check">
                  Open Phone Check <Icon name="arrowRight" />
                </Link>
                <Link className="button button--quiet" href="/check">Basic IMEI validation</Link>
              </div>
            </article>

            <article className="card service-hub-card service-hub-card--unlock">
              <div className="service-hub-icon"><Icon name="lock" /></div>
              <div className="service-hub-copy">
                <span className="kicker">Network and device access</span>
                <h2>Unlock Service</h2>
                <p>Browse published network, activation-lock and device-unlock prices by carrier, country and device type.</p>
              </div>
              <div className="service-hub-stats">
                <div><strong>{CUSTOMER_PRODUCT_COUNTS.unlock}</strong><span>published services</span></div>
                <div><strong>View only</strong><span>online ordering pending</span></div>
              </div>
              <div className="service-hub-actions">
                <Link className="button button--primary" href="/services/unlock">
                  Open Unlock Service <Icon name="arrowRight" />
                </Link>
              </div>
            </article>
          </div>

          <p className="t-micro service-hub-version">
            Prices and availability are current as shown. A report describes the phone at the moment it is run; it does not prove who owns it, and it does not guarantee the network will release it.
          </p>
        </div>
      </section>
    </>
  )
}

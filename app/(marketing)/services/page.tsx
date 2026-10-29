import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { storefrontAvailability } from '@/lib/storefront-availability'



export const dynamic = 'force-dynamic'

export const metadata = pageMetadata("/services", "Phone Unlock & IMEI Check Services", "Compare phone unlocking and IMEI check services. Browse device requirements, report types, prices and availability before choosing a service.")

export default function ServicesPage() {
  const checks = storefrontAvailability('imei_check')
  const unlock = storefrontAvailability('unlock')
  return (
    <>
      <section className="section section--tint">
        <div className="shell">
          <div className="section-head">
            <span className="kicker"><Icon name="grid" /> Service categories</span>
            <h1 className="t-display">Phone unlocking and IMEI check services.</h1>
            <p className="t-lead">
              Choose a category to see its services and prices.
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
                <p>Carrier, warranty, blacklist and lock status — before you buy, sell or unlock.</p>
              </div>
              <div className="service-hub-stats">
                <div><strong>{checks.publishedCount}</strong><span>published checks</span></div>
                <div><strong>{checks.availableCount}</strong><span>available online</span></div>
              </div>
              <div className="service-hub-actions">
                <Link className="button button--primary" href="/services/imei-check">
                  Open Phone Check <Icon name="arrowRight" />
                </Link>
                <Link className="button button--quiet" href="/check">Apple Free Check</Link>
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
                <div><strong>{unlock.publishedCount}</strong><span>published services</span></div>
                <div><strong>{unlock.availableCount}</strong><span>{unlock.accepting ? 'available online' : 'currently unavailable'}</span></div>
              </div>
              <div className="service-hub-actions">
                <Link className="button button--primary" href="/services/unlock">
                  Open Unlock Service <Icon name="arrowRight" />
                </Link>
              </div>
            </article>
          </div>

          <p className="t-micro service-hub-version">
            A report shows the phone’s status when it runs. It does not prove ownership or guarantee an unlock.
          </p>
        </div>
      </section>
    </>
  )
}


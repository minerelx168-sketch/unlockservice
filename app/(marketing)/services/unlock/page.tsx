import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { Icon } from '@/components/icons'
import { CUSTOMER_UNLOCK_PRODUCTS } from '@/lib/customer-provider-products'

export const metadata: Metadata = {
  title: 'Phone unlock services and prices',
  description: 'Browse phone unlock services and published prices by network, country and device type.',
}

export default function UnlockServicesPage() {
  return (
    <>
      <section className="section section--tint">
        <div className="shell">
          <div className="section-head">
            <nav className="service-breadcrumb" aria-label="Breadcrumb">
              <Link href="/services">Services</Link>
              <span aria-hidden="true">/</span>
              <span>Unlock Service</span>
            </nav>
            <span className="kicker"><Icon name="lock" /> Network and device access</span>
            <h1 className="t-display">Unlock Service.</h1>
            <p className="t-lead">
              Browse network, activation-lock and device-unlock prices by carrier, country and device type. This page contains Unlock products only.
            </p>
            <div className="hero-actions service-page-actions">
              <Link className="button button--primary" href="#unlock-catalog">
                Browse unlock prices <Icon name="arrowRight" />
              </Link>
              <Link className="button button--secondary" href="/services/imei-check">Go to Phone Check</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="unlock-catalog">
        <div className="shell">
          <ProductCatalog products={CUSTOMER_UNLOCK_PRODUCTS} domain="unlock" />
          <p className="t-micro service-catalog-version">
            Prices are current as shown. A service you cannot order yet is one we have not finished checking with the network behind it.
          </p>
        </div>
      </section>
    </>
  )
}

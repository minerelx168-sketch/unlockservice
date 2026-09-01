import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { Icon } from '@/components/icons'
import { PUBLIC_PROVIDER_PRODUCTS, PROVIDER_PRODUCT_CATALOG_VERSION } from '@/lib/provider-products'

export const metadata: Metadata = {
  title: 'Unlock & IMEI Check Services — iUnlockMobile',
  description: 'Browse available paid IMEI reports and Provider-listed phone unlocking services with transparent prices and availability.',
}

export default function ServicesPage() {
  return (
    <>
      <section className="section section--tint">
        <div className="shell">
          <div className="section-head">
            <span className="kicker"><Icon name="sparkle" /> Product catalog</span>
            <h1 className="t-display">Unlock and IMEI check services.</h1>
            <p className="t-lead">
              Browse the owner-approved Provider catalog with fixed USD prices. Products marked Available can be ordered online; Coming soon products are published for reference but cannot accept payment until their API contract is verified.
            </p>
            <div className="hero-actions" style={{ marginTop: 24 }}>
              <Link className="button button--primary" href="/user/reports/new">
                <Icon name="file" /> Order an IMEI report
              </Link>
              <Link className="button button--quiet" href="/check">
                Use the Free IMEI Check
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <ProductCatalog products={PUBLIC_PROVIDER_PRODUCTS} />
          <p className="t-micro" style={{ marginTop: 20 }}>
            Catalog version {PROVIDER_PRODUCT_CATALOG_VERSION}. Provider data is point-in-time and does not prove ownership or guarantee unlock eligibility.
          </p>
        </div>
      </section>
    </>
  )
}

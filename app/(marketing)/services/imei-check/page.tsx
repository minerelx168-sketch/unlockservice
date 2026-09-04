import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { Icon } from '@/components/icons'
import { CUSTOMER_IMEI_CHECK_PRODUCTS } from '@/lib/customer-provider-products'
import { PROVIDER_PRODUCT_CATALOG_VERSION } from '@/lib/provider-products'

export const metadata: Metadata = {
  title: 'Phone Check Services & Prices — iUnlockMobile',
  description: 'Browse Phone Check services with prices, availability and delivery estimates.',
}

export default function ImeiCheckServicesPage() {
  return (
    <>
      <section className="section section--tint">
        <div className="shell">
          <div className="section-head">
            <nav className="service-breadcrumb" aria-label="Breadcrumb">
              <Link href="/services">Services</Link>
              <span aria-hidden="true">/</span>
              <span>Phone Check</span>
            </nav>
            <span className="kicker"><Icon name="search" /> Device information</span>
            <h1 className="t-display">Phone Check.</h1>
            <p className="t-lead">
              Check device, carrier, warranty, blacklist and lock-status information. Every product on this page is a Phone Check service.
            </p>
            <div className="hero-actions service-page-actions">
              <Link className="button button--primary" href="/user/reports/new">
                <Icon name="file" /> Order a Phone Check
              </Link>
              <Link className="button button--secondary" href="/services/unlock">Go to Unlock Service</Link>
              <Link className="button button--quiet" href="/check">Run basic IMEI validation</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <ProductCatalog products={CUSTOMER_IMEI_CHECK_PRODUCTS} domain="imei_check" />
          <p className="t-micro service-catalog-version">
            Catalog version {PROVIDER_PRODUCT_CATALOG_VERSION}. Report information is point-in-time and does not prove ownership.
          </p>
        </div>
      </section>
    </>
  )
}

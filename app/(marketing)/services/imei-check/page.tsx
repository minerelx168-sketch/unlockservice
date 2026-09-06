import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { Icon } from '@/components/icons'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'

export const metadata: Metadata = {
  title: 'Phone Check services and prices',
  description: 'Browse Phone Check services with prices, availability and delivery estimates.',
}

export const dynamic = 'force-dynamic'

export default function ImeiCheckServicesPage() {
  const products = listPublicProviderProducts('imei_check')
  const available = products.some((product) => product.status === 'available')
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
              <Link className="button button--primary" href={available ? '/user/reports/new' : '#phone-check-catalog'}>
                <Icon name="file" /> {available ? 'Order a Phone Check' : 'Browse report prices'}
              </Link>
              <Link className="button button--secondary" href="/services/unlock">Go to Unlock Service</Link>
              <Link className="button button--quiet" href="/check">Run basic IMEI validation</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="phone-check-catalog">
        <div className="shell">
          {!available ? <p className="alert" role="status"><Icon name="info" /><span>Paid reports are temporarily unavailable. You can <Link href="/check">validate an IMEI for free</Link> or <Link href="/contact">contact support</Link>.</span></p> : null}
          <ProductCatalog products={products} domain="imei_check" />
          <p className="t-micro service-catalog-version">
            A report describes the phone at the moment it is run, and does not prove who owns it.
          </p>
        </div>
      </section>
    </>
  )
}

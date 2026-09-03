import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { Icon } from '@/components/icons'
import { PUBLIC_PROVIDER_PRODUCTS, PROVIDER_PRODUCT_CATALOG_VERSION } from '@/lib/provider-products'

export const metadata: Metadata = {
  title: 'Unlock & IMEI Check Services — iUnlockMobile',
  description: 'Browse IMEI Check and phone Unlock services in clearly separated categories with transparent prices and availability.',
}

function customerText(value: string) {
  return value
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const CUSTOMER_PRODUCTS = PUBLIC_PROVIDER_PRODUCTS.map((product) => ({
  ...product,
  name: customerText(product.name),
  group: customerText(product.group),
  summary: customerText(product.summary),
  etaLabel: customerText(product.etaLabel),
}))

export default function ServicesPage() {
  return (
    <>
      <section className="section section--tint">
        <div className="shell">
          <div className="section-head">
            <span className="kicker"><Icon name="sparkle" /> Product catalog</span>
            <h1 className="t-display">Unlock and IMEI check services.</h1>
            <p className="t-lead">
              Browse IMEI Check and Unlock services in clearly separated categories with fixed USD prices. Available reports can be ordered online; Coming soon services remain view-only until online ordering is verified.
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
          <ProductCatalog products={CUSTOMER_PRODUCTS} />
          <p className="t-micro" style={{ marginTop: 20 }}>
            Catalog version {PROVIDER_PRODUCT_CATALOG_VERSION}. Service information is point-in-time and does not prove ownership or guarantee unlock eligibility.
          </p>
        </div>
      </section>
    </>
  )
}

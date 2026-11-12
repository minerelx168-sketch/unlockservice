import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ServiceBrowser } from '@/components/service-browser'
import { currentSession } from '@/lib/auth'
import { listMemberUnlockDirectory } from '@/lib/public-provider-catalog'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'All unlock services', robots: { index: false, follow: false } }

export default async function MoreServices() {
  const viewer = await currentSession()
  if (!viewer) redirect('/login?next=/services/unlock/more')
  const products = listMemberUnlockDirectory()
  return <section className="section section--tint service-entry-section unlock-landing">
    <div className="shell">
      <nav className="service-breadcrumb" aria-label="Breadcrumb">
        <Link href="/services/unlock">Unlock Service</Link><span aria-hidden="true">/</span><span aria-current="page">All services</span>
      </nav>
      <div className="unlock-landing-grid">
        <header className="service-hero-copy unlock-landing-intro">
          <span className="hero-chip">Member services</span>
          <h1 className="service-entry-title">All unlock services</h1>
          <p className="t-lead">Search {products.length} services by network, device or name. Choose one to see its price, delivery estimate and requirements before you pay.</p>
        </header>
        <div className="hero-panel unlock-landing-form" id="unlock-entry-heading">
          <ServiceBrowser products={products} domain="unlock" initialEmail={viewer.user.email} />
        </div>
        <aside className="requirements-card unlock-landing-requirements"><h2>Before you order</h2><p>Check the original carrier and match the device to the selected service. Your order starts after payment.</p><Link className="link-arrow" href="/support">Get help choosing a service →</Link></aside>
      </div>
    </div>
  </section>
}

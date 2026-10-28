import { Icon } from './icons'
import type { DrawerGroup, DrawerLink } from './site-drawer'
import { SiteFooter, type FooterFact } from './site-footer'
import { SiteHeader } from './site-header'
import { logoutAction } from '@/lib/actions'
import { listArticles } from '@/lib/articles'
import { currentSession } from '@/lib/auth'
import { CARRIERS } from '@/lib/catalog'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'

/**
 * The public chrome, built on the server from the same catalog the
 * storefront sells from, so the drawer can never name a report and the
 * footer can never quote a count that does not exist. The marketing layout
 * and the not-found page both render it; they must not drift apart.
 */

async function chromeData() {
  const session = await currentSession()
  const isAuthenticated = session !== null
  const reports = listStorefrontProviderProducts('imei_check')
  const articles = listArticles()
  const networks = new Set(CARRIERS.map((carrier) => carrier.name)).size
  return { isAuthenticated, reports, articles, networks }
}

export async function PublicHeader() {
  const { isAuthenticated, reports } = await chromeData()

  const drawerGroups: DrawerGroup[] = [
    {
      id: 'unlock',
      label: 'Unlock',
      icon: 'lock',
      primary: { href: '/services/unlock', label: 'Unlock my phone', note: 'Remove the network lock by IMEI', icon: 'lock' },
      items: [
        { href: '/services/imei-check', label: 'Check lock status first', icon: 'search' },
        { href: '/articles/network-unlock-explained', label: 'How unlocking works', icon: 'file' },
        { href: '/track', label: 'Track an unlock order', icon: 'clock' },
      ],
    },
    {
      id: 'check',
      label: 'Phone Check',
      icon: 'search',
      primary: {
        href: '/services/imei-check',
        label: 'Browse all reports',
        note: `${reports.length} device checks available`,
        icon: 'grid',
      },
      items: reports.slice(0, 6).map((product) => ({
        href: `/services/imei-check?product=${encodeURIComponent(product.productCode)}`,
        label: product.name,
        icon: 'file' as const,
      })),
    },
  ]

  const drawerLinks: DrawerLink[] = [
    { href: '/articles', label: 'Guides', icon: 'file' },
    { href: '/track', label: 'Track order', icon: 'clock' },
    { href: '/support', label: 'Support', icon: 'question' },
  ]

  const accountSlot = isAuthenticated ? (
    <form action={logoutAction}>
      <button className="button button--quiet" type="submit">
        <Icon name="logout" strokeWidth={1.9} />
        Sign out
      </button>
    </form>
  ) : null

  return (
    <SiteHeader
      isAuthenticated={isAuthenticated}
      drawerGroups={drawerGroups}
      drawerLinks={drawerLinks}
      accountSlot={accountSlot}
    />
  )
}

export async function PublicFooter() {
  const { isAuthenticated, articles, networks } = await chromeData()

  const facts: FooterFact[] = [
    { icon: 'globe', title: `${networks} networks listed`, caption: 'Across four countries' },
    { icon: 'file', title: `${articles.length} guides`, caption: 'Written for buyers and sellers' },
    { icon: 'shieldCheck', title: 'Pay per order', caption: 'Guest card checkout available' },
    { icon: 'lock', title: 'Private results', caption: 'Track online and receive results by email' },
  ]
  const guides = articles.slice(0, 6).map((article) => ({ href: `/articles/${article.slug}`, label: article.title }))

  return <SiteFooter isAuthenticated={isAuthenticated} guides={guides} facts={facts} />
}

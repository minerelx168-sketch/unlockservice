'use client'
import {useLocale} from '@/lib/i18n/locale-context'
import {useCopy} from '@/lib/i18n/client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useState, type ReactNode } from 'react'
import {LocaleSwitch} from './locale-switch'
import {locales,paths} from '@/lib/geo-locales'
import {localeOf,prefixOf} from '@/lib/i18n/route-map'

import { Brand } from './brand'
import { Icon, type IconName } from './icons'
import { NavMenu } from './nav-menu'
import { SiteDrawer, type DrawerGroup, type DrawerLink } from './site-drawer'
import { ThemeToggle } from './theme-toggle'

const NAV: Array<{ href: string; label: string; icon: IconName; menu?: string }> = [
  { href: '/services/unlock', label: 'Unlock Service', icon: 'lock', menu: 'unlock' },
  { href: '/services/imei-check', label: 'Phone Check', icon: 'search', menu: 'check' },
  { href: '/articles', label: 'Article', icon: 'file' },
  { href: '/track', label: 'Order Tracking', icon: 'clock' },
  { href: '/contact', label: 'Contact us', icon: 'mail' },
]

type Props = {
  articleLinks?:Record<string,string>
  isAuthenticated?: boolean
  drawerGroups: DrawerGroup[]
  drawerLinks: DrawerLink[]
  accountSlot?: ReactNode
}

/**
 * Brand with its tagline, the five primary links — the two services carry
 * a menu of their own destinations — and the actions: theme, help, the
 * account pill, the menu. The menu button is permanent. On a wide screen
 * it opens the full service tree the links only summarise; below 1320px
 * the links step aside and it is the navigation.
 *
 * The drawer is rendered as a sibling of the header, not inside it: the
 * header's backdrop-filter makes it the containing block for anything
 * position:fixed, which would clip the sheet to 78px.
 */
export function SiteHeader({ articleLinks,isAuthenticated = false, drawerGroups, drawerLinks, accountSlot }: Props) {
  const t=useCopy()
  const pathname = usePathname()
  const l=useLocale(),ix=locales.indexOf(l)
  const localized=(href:string)=>l==='en'?href:href==='/services/unlock'?paths[1][ix]:href==='/services/imei-check'?paths[0][ix]:href==='/articles'?prefixOf(l)+'/articles':href
  const navLabel=(href:string)=>href.includes('unlock')?t("Unlock"):href.includes('imei-check')?t("Phone Check"):href==='/articles'?t("Guides"):href==='/contact'?t("Contact us"):t("Track order")
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const accountHref = isAuthenticated ? '/user/dashboard' : '/login'
  const accountLabel = isAuthenticated ? t("Account") : t("Sign in")

  /* The one way to the whole catalog, offered at the foot of each menu. */
  const menuLabels = ['Unlock','Phone Check','Unlock my phone','Remove the network lock by IMEI','Check lock status first','How unlocking works','Track an unlock order','Browse all reports','Apple Free Check'] as const
  const menuCopy=(s:string)=>{const key=menuLabels.find(k=>k===s);return key?t(key):s}
  const scopedGroups:DrawerGroup[]=drawerGroups.map(g=>({...g,label:menuCopy(g.label),primary:{...g.primary,href:localized(g.primary.href),label:menuCopy(g.primary.label),note:g.primary.note?.replace(/services listed$/,t('services listed')).replace('Remove the network lock by IMEI',t('Remove the network lock by IMEI'))},items:g.items.map(item=>({...item,href:localized(item.href),label:menuCopy(item.label)}))}))
  const scopedLinks:DrawerLink[]=l==='en'?drawerLinks:[{href:localized('/articles'),label:t('Guides')},{href:'/track',label:t('Track order')},{href:'/support',label:t('Support')}]
  const allServices = (
    <Link className="button button--primary" href={localized("/services")}>
      <Icon name="grid" strokeWidth={1.9} />{t("All services")} </Link>
  )

  return (
    <>
      <header className="site-header">
        <div className="shell">
          <Brand href={prefixOf(l)} tagline={[t("Unlock"),t("Phone Check"),t("Track order")].join(" · ")}/>

          <nav className="site-nav" id="site-nav" aria-label={t("Services")}>
            {NAV.map((item) => {
              const href = item.href === '/track' && isAuthenticated ? '/user/orders' : item.href
              // Keep the section highlighted while reading an individual article.
              const active = pathname === href || pathname.startsWith(`${href}/`)
              const group = item.menu ? scopedGroups.find((entry) => entry.id === item.menu) : undefined
              if (group) {
                return (
                  <NavMenu
                    key={item.label}
                    href={localized(href)}
                    label={l==="en"?item.label:navLabel(item.href)}
                    icon={item.icon}
                    group={group}
                    active={active}
                    footer={allServices}
                  />
                )
              }
              return (
                <Link
                  key={item.label}
                  href={localized(href)}
                  className={`nav-link${item.href === '/articles' ? ' nav-link--article' : ''}`}
                  data-active={active ? 'true' : undefined}
                  aria-current={href === pathname ? 'page' : undefined}
                >
                  <Icon name={item.icon} strokeWidth={1.9} />
                  <span>{l==="en"?item.label:navLabel(item.href)}</span>
                </Link>
              )
            })}
          </nav>

          <div className="header-actions">
            <LocaleSwitch articleLinks={articleLinks}/>
            <ThemeToggle />
            <Link className="icon-action header-help" href="/support" aria-label={t("Support")}>
              <Icon name="question" />
            </Link>
            {/* The one filled control in the header. The label collapses on
                a phone and the icon carries the button; aria-label keeps the
                name for anyone not reading the icon. */}
            <Link className="button button--primary header-account" href={accountHref} aria-label={accountLabel}>
              <Icon name="user" strokeWidth={1.9} />
              <span className="button-label">{accountLabel}</span>
            </Link>
            <button
              type="button"
              className="icon-action nav-toggle"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="site-drawer"
              aria-label={t("Open navigation")}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <SiteDrawer
        open={open}
        onClose={close}
        groups={scopedGroups}
        links={scopedLinks}
        isAuthenticated={isAuthenticated}
        accountSlot={accountSlot}
      />

      <nav className="mobile-nav" aria-label={t("Services")} hidden={open}>
        {([
          { href: '/services/unlock', label: t("Unlock"), icon: 'lock' },
          { href: '/services/imei-check', label: t("Phone Check"), icon: 'search' },
          { href: isAuthenticated ? '/user/orders' : '/track', label: t("Track order"), icon: 'clock' },
          { href: accountHref, label: t("Account"), icon: 'user' },
        ] as Array<{ href: string; label: string; icon: IconName }>).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (pathname === '/' && item.href === '/services/unlock')
          return <Link key={item.label} href={localized(item.href)} data-active={active || undefined} aria-current={pathname === item.href ? 'page' : active ? 'location' : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>
        })}
      </nav>

    </>
  )
}

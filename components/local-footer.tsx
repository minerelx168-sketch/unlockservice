'use client'
import {useLocale} from '@/lib/i18n/locale-context'
import {usePathname} from 'next/navigation'
import Link from 'next/link'
import {Brand} from './brand'
import {PaymentMark} from './payment-badges'
import {msg} from '@/lib/i18n/messages'
import {localeOf,prefixOf} from '@/lib/i18n/route-map'
import {locales,paths} from '@/lib/geo-locales'
export function LocalFooter({authenticated}:{authenticated:boolean}){const l=useLocale(),i=locales.indexOf(l),t=(k:Parameters<typeof msg>[1])=>msg(l,k);const groups:[string,string[][]][]=[[t('Service categories'),[[paths[0][i],t('Phone Check')],[paths[1][i],t('Unlock')],['/check',t('Apple Free Check')],['/register',t('Create an account')]]],[t('Help centre'),[['/track',t('Track order')],['/contact',t('Contact us')],[prefixOf(l)+'#faq',t('Common questions')],[authenticated?'/user/dashboard':'/login',t(authenticated?'Account':'Sign in')]]],[t('Legal'),[['/terms',t('Terms of service')],['/privacy',t('Privacy policy')],['/terms#refunds',t('Refunds and refused orders')]]],[t('Guides'),[[prefixOf(l)+'/articles',t('All guides')],[paths[2][i],t('Canada')],[paths[4][i],t('Austria')],[paths[3][i],t('Blacklist check')],['/tools',t('Free iPhone tools')]]]]
return <footer className="site-footer"><div className="shell"><div className="footer-grid"><div><Brand href={prefixOf(l)} tagline={[t('Unlock'),t('Phone Check'),t('Track order')].join(' · ')}/><p className="blurb">{t('Network-unlock services and device reports for phones you own.')}</p></div>{groups.map(([h,links])=><div key={h}><h4>{h}</h4><ul className="footer-links">{links.map(([href,name])=><li key={href}><Link href={href}>{name}</Link></li>)}</ul></div>)}</div><div className="footer-accept"><span>{t('We Accept:')}</span>{['visa','mastercard','googlepay','applepay','bitcoin','usdt'].map(m=><PaymentMark key={m} method={m}/>)}</div><div className="footer-base"><span>© 2016–{new Date().getFullYear()} iUnlockMobile. {t('All rights reserved.')}</span><span>{t('Unlocking releases a device you own — it does not remove a finance agreement or a theft report.')}</span></div></div></footer>}

'use client'
import {useLocale} from '@/lib/i18n/locale-context'
import {useEffect} from 'react'
import {usePathname,useRouter} from 'next/navigation'
import {routeFor,localeOf,prefixes} from '@/lib/i18n/route-map'
import {locales,markets,languages} from '@/lib/geo-locales'
import {msg} from '@/lib/i18n/messages'
import {Icon} from './icons'
export function LocaleSwitch({articleLinks}:{articleLinks?:Record<string,string>}={}){const path=usePathname(),router=useRouter(),l=useLocale()
useEffect(()=>{document.documentElement.lang=markets[locales.indexOf(l)];document.documentElement.dir=l==='ar'?'rtl':'ltr'},[l])
return <details key={path} className="locale-switch"><summary className="icon-action" aria-label={msg(l,'Choose language')}><Icon name="globe"/></summary><nav aria-label={msg(l,'Choose language')}>{locales.map((v,i)=><a key={v} lang={markets[i]} hrefLang={markets[i]} href={articleLinks?.[markets[i]]??routeFor(path,v)} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();document.cookie='NEXT_LOCALE='+prefixes[i]+'; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');window.dispatchEvent(new Event('localechange'));e.currentTarget.closest('details')?.removeAttribute('open');const dst=articleLinks?.[markets[i]]??routeFor(path,v);const qs=new URLSearchParams();if(dst.endsWith('/checkout')){const current=new URLSearchParams(location.search);for(const key of ['product','method']){const value=current.get(key);if(value)qs.set(key,value)}}router.push(dst+(qs.size?'?'+qs.toString():''));router.refresh()}}>{languages[i]}</a>)}</nav></details>}

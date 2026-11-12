'use client'
import {createContext,useContext,useSyncExternalStore} from 'react'
import {usePathname} from 'next/navigation'
import {effectiveLocale} from './route-map'
const LocaleCookie=createContext('en')
export const LocaleProvider=LocaleCookie.Provider
const subscribe=(cb:()=>void)=>{window.addEventListener('localechange',cb);return ()=>window.removeEventListener('localechange',cb)}
export function useLocale(){
 const path=usePathname(),initial=useContext(LocaleCookie)
 const cookie=useSyncExternalStore(subscribe,()=>document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/)?.[1]??'en',()=>initial)
 return effectiveLocale(path,cookie)
}

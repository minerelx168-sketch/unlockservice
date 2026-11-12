import {msg} from '@/lib/i18n/messages'
const title=msg('fr','Services')+' · iUnlockMobile',description=msg('fr','Network-unlock services and device reports for phones you own.')
export const metadata={title:{default:title,template:'%s — iUnlockMobile'},description,openGraph:{title,description,locale:'fr_CA',url:'/fr-ca'},twitter:{title,description}}
import type {ReactNode} from "react"
export default function Layout({children}:{children:ReactNode}){return children}

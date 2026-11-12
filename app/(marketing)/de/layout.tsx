import {msg} from '@/lib/i18n/messages'
const title=msg('de','Services')+' · iUnlockMobile',description=msg('de','Network-unlock services and device reports for phones you own.')
export const metadata={title:{default:title,template:'%s — iUnlockMobile'},description,openGraph:{title,description,locale:'de_AT',url:'/de'},twitter:{title,description}}
import type {ReactNode} from "react"
export default function Layout({children}:{children:ReactNode}){return children}

import {msg} from '@/lib/i18n/messages'
const title=msg('ar','Services')+' · iUnlockMobile',description=msg('ar','Network-unlock services and device reports for phones you own.')
export const metadata={title:{default:title,template:'%s — iUnlockMobile'},description,openGraph:{title,description,locale:'ar',url:'/ar'},twitter:{title,description}}
import type {ReactNode} from "react"
export default function Layout({children}:{children:ReactNode}){return <div dir="rtl" lang="ar">{children}</div>}

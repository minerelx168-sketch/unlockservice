import {msg} from '@/lib/i18n/messages'
const title=msg('pt','Services')+' · iUnlockMobile',description=msg('pt','Network-unlock services and device reports for phones you own.')
export const metadata={title:{default:title,template:'%s — iUnlockMobile'},description,openGraph:{title,description,locale:'pt_BR',url:'/pt'},twitter:{title,description}}
import type {ReactNode} from "react"
export default function Layout({children}:{children:ReactNode}){return children}

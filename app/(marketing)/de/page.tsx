import {StorefrontHome} from '@/components/storefront-home'
import {languageLinks} from '@/lib/landing-locales'
export const metadata={title:'Gebrauchtes iPhone vor dem Kauf prüfen',alternates:{canonical:'/de',languages:languageLinks('/de')}}
export default function Page(){return <StorefrontHome locale="de"/>}

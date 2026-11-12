import {StorefrontHome} from '@/components/storefront-home'
import {languageLinks} from '@/lib/landing-locales'
export const metadata={title:'Guides pour vérifier un iPhone usagé',alternates:{canonical:'/fr-ca',languages:languageLinks('/fr-ca')}}
export default function Page(){return <StorefrontHome locale="fr"/>}

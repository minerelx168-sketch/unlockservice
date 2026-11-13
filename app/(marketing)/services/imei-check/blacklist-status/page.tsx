import { ProductSchema } from '@/components/product-schema'
import {languageLinks} from '@/lib/landing-locales'
import { ServiceSpokePage } from '@/components/service-spoke'
import { SERVICE_SPOKES } from '@/lib/service-spokes'
import { pageMetadata } from '@/lib/seo'
export const dynamic = 'force-dynamic'
const spoke = SERVICE_SPOKES[2]
export const metadata = {...pageMetadata(spoke.path, spoke.title, spoke.description),alternates:{canonical:'/services/imei-check/blacklist-status',languages:languageLinks('/services/imei-check/blacklist-status')}}
export default function Page() { return <><ProductSchema path="/services/imei-check/blacklist-status" serviceIds={['66']} /><ServiceSpokePage spoke={spoke} /></> }

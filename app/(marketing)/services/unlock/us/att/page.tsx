import {languageLinks} from '@/lib/landing-locales'
import { ServiceSpokePage } from '@/components/service-spoke'
import { SERVICE_SPOKES } from '@/lib/service-spokes'
import { pageMetadata } from '@/lib/seo'
export const dynamic = 'force-dynamic'
const spoke = SERVICE_SPOKES[0]
export const metadata = {...pageMetadata(spoke.path, spoke.title, spoke.description),alternates:{canonical:'/services/unlock/us/att',languages:languageLinks('/services/unlock/us/att')}}
export default function Page() { return <ServiceSpokePage spoke={spoke} /> }

import { CarrierGuide } from '@/components/carrier-guide'
import { guides } from '@/lib/carrier-guides'
import { pageMetadata } from '@/lib/seo'
export const dynamic='force-dynamic'
const guide=guides.carrier
export const metadata=pageMetadata(guide.path,guide.title,guide.intro)
export default function Page(){return <CarrierGuide id="carrier"/>}

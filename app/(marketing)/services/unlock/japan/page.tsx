import {GuideLayout} from '@/components/guide-layout'
import {listStorefrontProviderProducts} from '@/lib/public-provider-catalog'
import {pageMetadata} from '@/lib/seo'
export const dynamic='force-dynamic'
const title='Japan carrier unlock services'
const intro='Compare the original network, supported device, service price and delivery estimate before ordering.'
export const metadata=pageMetadata('/services/unlock/japan',title,intro)
export default function Page(){return <GuideLayout title={title} intro={intro} locale="en" tag="Japan" domain="unlock" note="Only order for a device you own or are authorized to service. Check eligibility with the original carrier first." products={listStorefrontProviderProducts('unlock').filter(p=>p.group==='Japan Networks')}/>}

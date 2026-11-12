import {languageLinks} from '@/lib/landing-locales'
import { CarrierGuide } from '@/components/carrier-guide'
import { guides } from '@/lib/carrier-guides'
import { pageMetadata } from '@/lib/seo'
export const dynamic='force-dynamic'
const guide=guides.ca
export const metadata={...pageMetadata(guide.path,guide.title,guide.intro),alternates:{canonical:'/services/unlock/canada',languages:languageLinks('/services/unlock/canada')}}
export default async function Page({searchParams}:{searchParams:Promise<{product?:string}>}){
  return <CarrierGuide id="ca" product={(await searchParams).product}/>
}

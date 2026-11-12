import {languageLinks} from '@/lib/landing-locales'
import {pageMetadata} from '@/lib/seo'
import {StorefrontHome} from '@/components/storefront-home'
export const metadata = {...pageMetadata("/", "IMEI Phone Unlocking & Device Check Reports", "Compare IMEI phone unlock services and device reports. Review availability, prices and delivery estimates before ordering with iUnlockMobile."),alternates:{canonical:'/',languages:languageLinks('/')}}
export default function Page(){return <StorefrontHome locale="en"/>}

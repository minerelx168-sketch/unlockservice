import { CheckHub, checkHubMetadata } from '@/components/check-hub'

export const dynamic = 'force-dynamic'
export const metadata = checkHubMetadata('t-mobile-us', 'en')
export default function Page() { return <CheckHub slug="t-mobile-us" locale="en" /> }

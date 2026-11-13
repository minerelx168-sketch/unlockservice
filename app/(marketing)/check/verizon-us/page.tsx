import { CheckHub, checkHubMetadata } from '@/components/check-hub'

export const dynamic = 'force-dynamic'
export const metadata = checkHubMetadata('verizon-us', 'en')
export default function Page() { return <CheckHub slug="verizon-us" locale="en" /> }

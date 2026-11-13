import { CheckHub, checkHubMetadata } from '@/components/check-hub'

export const dynamic = 'force-dynamic'
export const metadata = checkHubMetadata('cricket-wireless', 'en')
export default function Page() { return <CheckHub slug="cricket-wireless" locale="en" /> }

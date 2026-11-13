import { CheckHub, checkHubMetadata, checkHubParams } from '@/components/check-hub'

type Props = { params: Promise<{ hub: string }> }
export const dynamic = 'force-dynamic'
export const dynamicParams = false
export const generateStaticParams = checkHubParams
export async function generateMetadata({ params }: Props) { return checkHubMetadata((await params).hub, 'de') }
export default async function Page({ params }: Props) { return <CheckHub slug={(await params).hub} locale="de" /> }

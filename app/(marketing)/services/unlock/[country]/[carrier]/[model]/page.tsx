import { notFound } from 'next/navigation'
import { ProgrammaticTool, toolMetadata } from '@/components/programmatic-tool'
import { getPublishedProgrammaticRoutes } from '@/lib/data/programmatic-rollout'

export const dynamicParams = false
export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ country: string; carrier: string; model: string }> }

export function generateStaticParams() {
  return getPublishedProgrammaticRoutes().filter(route => route.carrier?.kind === 'unlock').map(route => ({ country: route.carrier!.country, carrier: route.carrier!.slug, model: route.model.slug }))
}
async function resolve({ params }: Props) {
  const values = await params
  const path = '/services/unlock/' + values.country + '/' + values.carrier + '/' + values.model
  return getPublishedProgrammaticRoutes().find(route => route.path === path) ?? notFound()
}
export async function generateMetadata(props: Props) {
  return toolMetadata(await resolve(props))
}
export default async function Page(props: Props) {
  return <ProgrammaticTool route={await resolve(props)}/>
}

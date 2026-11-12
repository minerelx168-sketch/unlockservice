import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentSession } from '@/lib/auth'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'
export const dynamic = 'force-dynamic'
export const metadata = {title:'Member unlock services',robots:{index:false,follow:false}}
export default async function MoreServices() {
  if (!(await currentSession())) redirect('/login?next=/services/unlock/more')
  return <section className="section shell"><h1>Member unlock services</h1><p>Select a service to review its requirements and price.</p><ul>{listStorefrontProviderProducts('unlock',true).map(p=><li key={p.productCode}>{p.status==='available'?<Link prefetch={false} href={'/user/reports/new?product='+p.productCode}>{p.name}</Link>:<span>{p.name} · Currently unavailable</span>}</li>)}</ul></section>
}

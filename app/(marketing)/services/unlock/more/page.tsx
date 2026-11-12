import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentSession } from '@/lib/auth'
import { groupServices } from '@/lib/service-groups'
import { listMemberUnlockDirectory } from '@/lib/public-provider-catalog'
export const dynamic = 'force-dynamic'
export const metadata = {title:'Member unlock services',robots:{index:false,follow:false}}
export default async function MoreServices() {
  if (!(await currentSession())) redirect('/login?next=/services/unlock/more')
  const products = listMemberUnlockDirectory()
  return <section className="section shell member-directory">
    <h1>All unlock services</h1>
    <p>{products.length} services · Select a service to review its price and requirements.</p>
    {groupServices(products).map(({ group, products: entries }) => <section key={group}>
      <h2>{group}</h2>
      <ul>{entries.map(p => <li key={p.productCode}>
        {p.status === 'available'
          ? <Link prefetch={false} href={'/user/reports/new?product='+encodeURIComponent(p.productCode)}>{p.name}</Link>
          : <span>{p.name} · Currently unavailable</span>}
      </li>)}</ul>
    </section>)}
  </section>
}

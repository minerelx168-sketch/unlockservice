import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export const metadata = { title:'Find a GA4 transaction', robots:{index:false,follow:false} }

export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}) {
  await requireAdmin()
  const value=(await searchParams).id
  const id=typeof value==='string' ? value.trim() : ''
  const match=/^(?:(guest|topup)-([a-f0-9]{32})|(unlock|report)-([1-9][0-9]{0,14}))$/.exec(id)
  let row:{email:string}|undefined
  if(match){
    const sql=match[1]==='guest'?'SELECT email FROM guest_checkouts WHERE reference=?':
      match[1]==='topup'?'SELECT u.email FROM invoices i JOIN users u ON u.id=i.user_id WHERE i.reference=?':
      match[3]==='unlock'?'SELECT u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?':
      'SELECT u.email FROM paid_report_orders o JOIN users u ON u.id=o.user_id WHERE o.id=?'
    row=db().prepare(sql).get(match[2]||match[4]) as {email:string}|undefined
  }
  return <section className="panel"><h1>Find a GA4 transaction</h1>
    <p>Copy the transaction ID from Analytics. Customer email is shown only here.</p>
    <form><label>Transaction ID<input name="id" maxLength={64} required defaultValue={id.slice(0,64)}/></label><button type="submit">Find customer</button></form>
    {id && <p>{row ? 'Customer email: '+row.email : 'No matching transaction.'}</p>}</section>
}

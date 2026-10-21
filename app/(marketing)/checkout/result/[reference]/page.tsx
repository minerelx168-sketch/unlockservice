import { notFound } from 'next/navigation'
import { authorizedGuestCheckout, guestResult } from '@/lib/guest-checkout'
import { GuestOrderResult } from '@/components/guest-order-result'
import '@/styles/guest-checkout.css'
export const dynamic='force-dynamic'
export const metadata={title:'Your service order | iUnlockMobile',robots:{index:false,follow:false,noarchive:true},referrer:'no-referrer' as const}
export default async function ResultPage({params,searchParams}:{params:Promise<{reference:string}>;searchParams:Promise<{key?:string}>}) {
  const key=(await searchParams).key??'',row=authorizedGuestCheckout((await params).reference,key)
  if(!row) notFound()
  return <GuestOrderResult initial={guestResult(row)} accessKey={key}/>
}

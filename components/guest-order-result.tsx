'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatUsd } from '@/lib/money'
import type { guestResult } from '@/lib/guest-checkout'
type Result=ReturnType<typeof guestResult>
const copy:Record<string,[string,string]>={pending:['Waiting for payment confirmation','Your order starts after the payment provider confirms your payment. If you have just paid, this page will update automatically.'],paid:['Payment confirmed','We are preparing your service order. Your confirmation and tracking link will be sent by email.'],processing:['Your service is in progress','You can close this page. We will email you when your result is ready.'],completed:['Your result is ready','Your result is shown below and will also be sent to your delivery email.'],refund_pending:['Refund requested','We could not deliver this service. Your refund to the original payment method is being processed.'],refunded:['Payment refunded','The payment provider confirmed your refund to the original payment method. Your bank may take additional time to display it.'],review:['Your order needs a review','Our team needs to check this order. Please keep your order reference. Do not pay again.']}
export function GuestOrderResult({initial,accessKey}:{initial:Result;accessKey:string}) {
  const [result,setResult]=useState(initial),[error,setError]=useState('')
  useEffect(()=>{
    if(['completed','refunded'].includes(result.state)) return
    let stopped=false
    const timer=setInterval(async()=>{try {
      const response=await fetch(`/api/checkout/guest/${initial.reference}`,{headers:{'x-order-key':accessKey},cache:'no-store'})
      if(!response.ok) throw new Error()
      const data:Result=await response.json()
      if(!stopped){setResult(data);setError('')}
    } catch {if(!stopped)setError('Unable to refresh right now. Your order is safe; try reloading this page.')}},10000)
    return()=>{stopped=true;clearInterval(timer)}
  },[initial.reference,accessKey,result.state])
  const message=result.paymentMethod==='crypto' && result.state==='refund_pending' ? ['Crypto refund needs review','We could not deliver this service. Contact support with your order reference so our team can confirm a safe receiving wallet and arrange your crypto refund. Do not send another payment.'] : result.paymentMethod==='crypto' && result.state==='refunded' ? ['Payment refunded','Your crypto refund has been recorded. Contact support with your order reference if you need the transfer details.'] : copy[result.state]??copy.review
  const isUnlock=result.domain==='unlock'
  const terminal=result.state==='completed'||result.refused||['refund_pending','refunded'].includes(result.state)
  const outcome=result.refused?'Refused':result.state==='refunded'?'Refunded':result.state==='refund_pending'?'Refund pending':'Completed'
  const steps=[{name:'Received',done:result.paymentReceived},{name:isUnlock?'Submitted':'Checking',done:result.submitted},{name:outcome,done:terminal}]
  const title=result.state==='completed'?(isUnlock?'Your unlock result is ready':'Your full report is ready'):['paid','processing'].includes(result.state)?'Order received':message[0]
  return <section className="guest-shell guest-result"><span className="eyebrow">{isUnlock?'UNLOCK ORDER':'PHONE CHECK ORDER'}</span><h1 aria-live="polite">{title}</h1><p>{message[1]}</p>
    <ol className="guest-progress" aria-label="Order progress">{steps.map((step,index)=><li key={index} data-done={step.done?'true':'false'} aria-current={!terminal&&index===(result.submitted?1:0)?'step':undefined}><span aria-hidden="true">{step.done?'✓':index+1}</span><strong>{step.name}</strong>{!step.done?<small>Pending</small>:null}</li>)}</ol>
    <article className="guest-card"><h2>{result.productName}</h2><p className="guest-reference">Order reference: {result.reference}</p><p>Order total before tax: <strong>{formatUsd(result.priceCents+result.feeCents+result.walletCreditCents)}</strong></p>
      {result.walletCreditCents>0 ? <p className="guest-credit-note"><strong>{result.walletCreditApplied ? `${formatUsd(result.walletCreditCents)} was added to your account credit.${result.walletCreditReview ? ' A payment review currently restricts spending.' : ''}` : ['refunded','refund_pending'].includes(result.state) ? 'The unused account credit is included in your card refund.' : result.walletCreditReview ? 'Your account credit is under payment review. Contact support with this order reference.' : `${formatUsd(result.walletCreditCents)} will be saved as account credit after payment is confirmed.`}</strong>{result.walletCreditApplied ? <> <Link href="/user/dashboard">View my credit</Link></> : null}</p> : null}
      {result.cryptoReceivedCents!==null && result.cryptoReceivedCents>result.priceCents ? <p className="guest-note">We received {formatUsd(result.cryptoReceivedCents)} for this {formatUsd(result.priceCents)} service. Contact support with your order reference to arrange the return of the extra {formatUsd(result.cryptoReceivedCents-result.priceCents)}.</p>:null}
      {!terminal&&result.paymentReceived?<p className="guest-note">{isUnlock?'We submit your paid order to the service provider and update this page when they respond.':'Your paid check starts automatically. The full report appears here as soon as the provider returns it.'} No need to keep this page open.</p>:null}
      {result.report ? <div className="guest-report"><p>IMEI: {result.report.imei??result.report.maskedImei}</p>{result.report.providerCode ? <pre>{result.report.providerCode}</pre> : result.report.report?.sections.map((section,index)=><section key={index}><h3>{section.title}</h3><dl>{section.items.map((item,i)=><div key={i}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>)}</div>:null}
      {error?<p role="status">{error}</p>:null}<p className="guest-note">Keep this link private. Anyone with it can view this order and its result.</p>
      {result.paymentReceived?<p className="guest-note">{result.walletCreditCents>0 ? 'Your private order link was sent to your account email. You can also find this order in your account.' : 'Your email contains your private order link. You can view this result without a password; account activation and setting a password are optional.'}</p>:null}
      <Link className="button button--secondary" href="/support">Contact support</Link>
    </article></section>
}

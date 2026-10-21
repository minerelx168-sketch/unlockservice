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
  const message=copy[result.state]??copy.review
  return <section className="guest-shell guest-result"><span className="eyebrow">YOUR PRIVATE ORDER PAGE</span><h1 aria-live="polite">{message[0]}</h1><p>{message[1]}</p>
    <article className="guest-card"><h2>{result.productName}</h2><p className="guest-reference">Order reference: {result.reference}</p><p>Order total before tax: <strong>{formatUsd(result.priceCents+result.feeCents)}</strong></p>
      {result.report ? <div className="guest-report"><p>IMEI: {result.report.imei??result.report.maskedImei}</p>{result.report.providerCode ? <pre>{result.report.providerCode}</pre> : result.report.report?.sections.map((section,index)=><section key={index}><h3>{section.title}</h3><dl>{section.items.map((item,i)=><div key={i}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>)}</div>:null}
      {error?<p role="status">{error}</p>:null}<p className="guest-note">Keep this link private. Anyone with it can view this order and its result.</p>
      <Link className="button button--secondary" href="/support">Contact support</Link>
    </article></section>
}

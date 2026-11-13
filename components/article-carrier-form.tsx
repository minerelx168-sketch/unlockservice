'use client'
import { useActionState, useRef, useState } from 'react'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { serviceIdentifier } from '@/lib/service-identifier'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import styles from '@/styles/article-carrier-widget.module.css'

export function ArticleCarrierForm({method}:{method:'card'|'crypto'}) {
  const [state,action,pending]=useActionState(continueDeviceServiceAction,{})
  const [imei,setImei]=useState('')
  const started=useRef(false), lastChecked=useRef('')
  const digits=imei.replace(/[\s-]/g,'')
  const valid=!!serviceIdentifier(imei)
  const meta={source:'article_carrier_widget',service_category:'imei_check',item_id:'444'}
  return <form className={'price-check '+styles.form} action={action} aria-busy={pending} data-widget="quick-imei-check" onSubmit={()=>trackFunnelEvent('imei_widget_submit',{...meta,currency:'USD',validation_status:valid?'success':'invalid'})}>
    <input type="hidden" name="domain" value="imei_check"/><input type="hidden" name="productCode" value="APPLE_CARRIER_LITE"/><input type="hidden" name="paymentMethod" value={method}/>
    <label htmlFor="quick-imei">15-digit IMEI</label>
    <input id="quick-imei" name="imei" type="text" inputMode="numeric" required autoComplete="off" placeholder="Enter the number shown on your phone" aria-describedby="quick-imei-feedback" value={imei} onChange={e=>{
      const raw=e.currentTarget.value.replace(/[\s-]/g,'')
      const formatted=/^\d{0,15}$/.test(raw)?[raw.slice(0,6),raw.slice(6,8),raw.slice(8,14),raw.slice(14)].filter(Boolean).join(' '):e.currentTarget.value
      setImei(formatted)
      const ok=!!serviceIdentifier(formatted)
      e.currentTarget.setCustomValidity(!formatted||ok?'':'Enter a valid 15-digit IMEI.')
      if(raw&&!started.current){started.current=true;trackFunnelEvent('imei_input_started',meta)}
      if(raw.length===15&&lastChecked.current!==raw){lastChecked.current=raw;trackFunnelEvent('validation_result',{...meta,validation_status:ok?'success':'invalid'})}
    }}/>
    <small id="quick-imei-feedback" aria-live="polite">{!digits?'Dial *#06# or open Settings → General → About.':valid?'✓ Valid IMEI format':/^\d{1,14}$/.test(digits)?(15-digits.length)+' digits remaining':'Check the digits against your device.'}</small>
    <span className="t-micro">{digits.replace(/\D/g,'').length}/15</span>{valid&&<div className="requirements-card"><strong>TAC {digits.slice(0,8)}</strong><p>Model: {['35838974','35782225','35739909'].includes(digits.slice(0,8))?'iPhone XR (reference match)':'Not identified offline'}</p><p>Carrier: <span className={styles.mask} aria-hidden="true">••••••••</span> · Available after lookup</p></div>}<label htmlFor="quick-email">Delivery email</label><input id="quick-email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/>
    <button className="button button--primary" type="submit" disabled={pending}>{pending?'Opening checkout…':'Continue to secure checkout →'}</button>
    {state.error&&<p role="alert">{state.error}</p>}
  </form>
}

'use client'
import { useActionState,useRef } from 'react'
import { browseDevicesAction } from '@/lib/device-intent-actions'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { useState } from 'react'
export function CarrierGuideForm({price,unlockPrice}:{price:string|null;unlockPrice:string|null}){
  const [state,action,pending]=useActionState(browseDevicesAction,{})
  const started=useRef(false)
  const [unlock,setUnlock]=useState(!price)
  if(!price && !unlockPrice)return <p>Online ordering is unavailable. You can still use the free checks below.</p>
  return <form action={action} className="field">
    <label htmlFor="guide-imei">Device IMEI · dial *#06#</label>
    <input id="guide-imei" type="text" name="imei" inputMode="numeric" pattern="[0-9]{15}" minLength={15} maxLength={15} required placeholder="15-digit IMEI" onChange={()=>{if(!started.current){started.current=true;trackFunnelEvent('imei_input_started',{service_category:unlock?'unlock':'imei_check'})}}}/>
    <label htmlFor="guide-task">What do you need?</label>
    <select id="guide-task" name="domain" value={unlock?'unlock':'imei_check'} onChange={e=>setUnlock(e.target.value==='unlock')}>
      {price&&<option value="imei_check">Check original carrier · {price} USD</option>}
      {unlockPrice&&<option value="unlock">Compare eligible unlocks · from {unlockPrice} USD</option>}
    </select>
    <input type="hidden" name="productCode" value={unlock?'':'APPLE_CARRIER_LITE'}/>
    <button className="button button--primary" disabled={pending}>{pending?'Opening…':'Continue to service'}</button>
    {state.error&&<p role="alert">{state.error}</p>}
    <small>No charge at this step. Review the service and total before paying.</small>
  </form>
}

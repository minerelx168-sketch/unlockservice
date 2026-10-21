'use client'
import { useState } from 'react'

export function GuestAccountActivation({reference,token,canSetPassword}:{reference:string;token:string;canSetPassword:boolean}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <form onSubmit={async event=>{
    event.preventDefault();setBusy(true);setError('')
    const data=new FormData(event.currentTarget)
    try {
      const response=await fetch('/api/checkout/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference,token,password:String(data.get('password')??'')})})
      const result=await response.json()
      if(!response.ok) throw new Error(result.error??'Unable to save this order right now.')
      window.location.assign(result.url)
    } catch(error) {setError(error instanceof Error?error.message:'Please try again.');setBusy(false)}
  }}>
    {canSetPassword?<label className="field"><span>Password <small>(optional)</small></span><input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} placeholder="Leave empty to continue without one"/><small>You can choose a password later. Your private order link works without it.</small></label>:<p>Your existing password stays unchanged.</p>}
    {error?<p role="alert">{error}</p>:null}
    <button className="button button--primary" type="submit" disabled={busy}>{busy?'Saving…':'Save order and continue'}</button>
  </form>
}

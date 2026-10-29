'use client'
import { useState,type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Key={id:number;name:string;prefix:string;revoked_at:string|null}
export function ResellerSettings({csrfToken,keys,webhook}:{csrfToken:string;keys:Key[];webhook?:{url:string;enabled:number}}) {
  const router=useRouter()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [secret,setSecret]=useState<{label:string;value:string}|null>(null)
  async function command(body:Record<string,unknown>) {
    setBusy(true);setError('');setNotice('');setSecret(null)
    try {
      const response=await fetch('/api/reseller/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,csrfToken})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||'Could not save. Please try again.')
      if(data.api_key) setSecret({label:'New API key — copy now; it will not be shown again.',value:data.api_key})
      if(data.signing_secret) setSecret({label:'Webhook signing secret — copy now; it will not be shown again.',value:data.signing_secret})
      setNotice('Saved.');router.refresh()
    }catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}
  }
  function submit(event:FormEvent<HTMLFormElement>,action:string) {
    event.preventDefault();const form=new FormData(event.currentTarget)
    void command({action,name:form.get('name'),url:form.get('url')})
  }
  return <div className="reseller-settings">
    {error?<p className="alert alert--error" role="alert">{error}</p>:null}
    {notice?<p role="status">{notice}</p>:null}
    {secret?<section className="panel"><div className="panel-body"><strong>{secret.label}</strong>
      <textarea className="reseller-secret" readOnly value={secret.value} aria-label={secret.label} onFocus={event=>event.target.select()} rows={3}/>
      <button className="button button--quiet" type="button" onClick={()=>setSecret(null)}>I saved it — hide</button></div></section>:null}
    <section className="panel"><header><h2>API keys</h2></header><div className="panel-body">
      <p>Connect from your server. Keys can read your results and spend your wallet on services. Keep them out of browser code.</p>
      <form className="reseller-form" onSubmit={event=>submit(event,'create_key')}>
        <label>Key name<input name="name" required maxLength={60} placeholder="My store server" autoComplete="off"/></label>
        <button className="button button--primary" disabled={busy} type="submit">Create API key</button>
      </form>
      <ul className="reseller-key-list">{keys.map(key=><li key={key.id}><span><strong>{key.name}</strong><small>{key.prefix}… · {key.revoked_at?'Revoked':'Active'}</small></span>
        {!key.revoked_at?<button className="button button--quiet" type="button" disabled={busy} onClick={()=>void command({action:'revoke_key',id:key.id})}>Revoke</button>:null}</li>)}</ul>
    </div></section>
    <section className="panel"><header><h2>Result webhook</h2><span>{webhook?.enabled?'Enabled':'Not enabled'}</span></header><div className="panel-body">
      <p>We send completed or refunded orders to this HTTPS endpoint. Results also stay in your account. Saving rotates the secret; older queued events stay available through the API.</p>
      <form className="reseller-form" onSubmit={event=>submit(event,'save_webhook')}>
        <label>Webhook URL<input name="url" type="url" required defaultValue={webhook?.url} placeholder="https://your-store.com/webhooks/iunlockmobile" autoComplete="off" maxLength={2048}/></label>
        <button className="button button--primary" disabled={busy} type="submit">Save webhook &amp; new secret</button>
      </form>
      {webhook?.enabled?<button className="button button--quiet" type="button" disabled={busy} onClick={()=>void command({action:'disable_webhook'})}>Disable webhook</button>:null}
    </div></section>
  </div>
}

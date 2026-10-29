import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { db } from './db'
import { requireReseller, resellerOrderForUser, ResellerError } from './reseller'

function encryptionKey() {
  const secret=process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET
  if(!secret || secret.length<32) {
    if(process.env.NODE_ENV==='production') throw new ResellerError('Webhook encryption is unavailable.',503)
  }
  return Buffer.from(hkdfSync('sha256',secret||'reseller-local-tests-only','iunlockmobile-reseller-webhooks-v1','secret',32))
}
function encrypt(secret:string) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv)
  cipher.setAAD(Buffer.from('reseller-webhook-v1'))
  const data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()])
  return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64url')).join('.')
}
function decrypt(value:string) {
  const [iv,tag,data]=value.split('.').map(s=>Buffer.from(s,'base64url'))
  const cipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv)
  cipher.setAAD(Buffer.from('reseller-webhook-v1'));cipher.setAuthTag(tag)
  return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8')
}
export function webhookUrl(raw:string):URL {
  let url:URL
  try {url=new URL(raw)} catch {throw new ResellerError('Enter a public HTTPS webhook URL.')}
  if(raw.length>2048||url.protocol!=='https:'||url.username||url.password||url.hash||url.port
    ||isIP(url.hostname)||!url.hostname.includes('.')||url.hostname.endsWith('.')
    ||/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(url.hostname)) {
    throw new ResellerError('Use a public HTTPS hostname on port 443, without credentials or a fragment.')
  }
  return url
}
/** IPv4-only delivery fails closed for IPv6-only/private/mixed DNS answers. */
export function publicWebhookAddress(address:string) {
  if(isIP(address)!==4) return false
  const [a,b,c]=address.split('.').map(Number)
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31
    ||a===192&&(b===168||b===0||b===2||b===88&&c===99)||a===100&&b>=64&&b<=127
    ||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113)
}
async function addresses(url:URL) {
  let timer:ReturnType<typeof setTimeout>|undefined
  try {
    const found=await Promise.race([lookup(url.hostname,{all:true,family:4}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('dns_timeout')),3000)})])
    if(!found.length||found.some(a=>!publicWebhookAddress(a.address))) throw new ResellerError('Webhook hostname must resolve only to public IPv4 addresses.')
    return found
  } finally {clearTimeout(timer)}
}
export async function saveResellerWebhook(userId:number,raw:string) {
  requireReseller(userId)
  const url=webhookUrl(raw);await addresses(url)
  const secret=`whsec_${randomBytes(32).toString('hex')}`,version=randomBytes(16).toString('hex')
  db().transaction(()=>{
    requireReseller(userId)
    db().prepare(`INSERT INTO reseller_webhooks(user_id,url,secret_encrypted,version) VALUES (?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET url=excluded.url,secret_encrypted=excluded.secret_encrypted,version=excluded.version,enabled=1,updated_at=datetime('now')`)
      .run(userId,url.href,encrypt(secret),version)
  }).immediate()
  return {url:url.href,signing_secret:secret}
}
export function disableResellerWebhook(userId:number) {
  requireReseller(userId)
  db().prepare('UPDATE reseller_webhooks SET enabled=0 WHERE user_id=?').run(userId)
}
export function resellerWebhookSettings(userId:number) {
  return db().prepare('SELECT url,enabled,updated_at FROM reseller_webhooks WHERE user_id=?').get(userId) as {url:string;enabled:number;updated_at:string}|undefined
}
export function webhookSignature(secret:string,id:string,timestamp:string,payload:string) {
  return createHmac('sha256',secret).update(`${id}.${timestamp}.${payload}`).digest('hex')
}
/** DNS is validated for every attempt and pinned into the TLS socket; redirects are never followed. */
export async function sendResellerWebhook(urlValue:string,body:string,headers:Record<string,string>) {
  const url=webhookUrl(urlValue),resolved=await addresses(url),address=resolved[0].address
  await new Promise<void>((resolve,reject)=>{
    const request=httpsRequest(url,{method:'POST',agent:false,family:4,
      lookup:(_hostname,options,callback)=>{
        if(options.all) callback(null,[{address,family:4}])
        else callback(null,address,4)
      },headers:{...headers,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'User-Agent':'iUnlockMobile-Webhooks/1'}},response=>{
      // Status alone acknowledges delivery. Never download or log a remote response body.
      const ok=response.statusCode!==undefined&&response.statusCode>=200&&response.statusCode<300
      response.destroy()
      if(ok) resolve();else reject(new Error('http_rejected'))
    })
    const deadline=setTimeout(()=>request.destroy(new Error('delivery_timeout')),8000)
    request.on('close',()=>clearTimeout(deadline));request.on('error',reject);request.end(body)
  })
}
export function webhookDeliveries(userId:number) {
  return db().prepare('SELECT e.id,e.order_id,e.event,e.attempts,e.sent_at,e.last_error,e.created_at,CASE WHEN w.enabled=1 AND w.version=e.endpoint_version THEN 1 ELSE 0 END AS endpoint_active FROM reseller_webhook_events e LEFT JOIN reseller_webhooks w ON w.user_id=e.user_id WHERE e.user_id=? ORDER BY e.created_at DESC LIMIT 20').all(userId) as Array<{
    id:string;order_id:number;event:string;attempts:number;endpoint_active:number;sent_at:string|null;last_error:string|null;created_at:string
  }>
}
export async function deliverResellerWebhooks(limit=10,send=sendResellerWebhook) {
  const stats={sent:0,failed:0}
  for(let i=0;i<Math.max(0,Math.min(limit,50));i++) {
    const now=Date.now(),lease=now+30000
    const job=db().transaction(()=>{
      const row=db().prepare(`SELECT e.*,w.url,w.secret_encrypted FROM reseller_webhook_events e
        JOIN reseller_webhooks w ON w.user_id=e.user_id AND w.version=e.endpoint_version AND w.enabled=1
        JOIN users u ON u.id=e.user_id AND u.account_type='reseller' AND u.status='active' AND u.banned_at IS NULL
        WHERE e.sent_at IS NULL AND e.attempts<12 AND e.next_at<=? AND e.lease_until<=? ORDER BY e.next_at,e.created_at LIMIT 1`).get(now,now) as
        {id:string;user_id:number;order_id:number;event:string;attempts:number;url:string;secret_encrypted:string}|undefined
      if(row) db().prepare('UPDATE reseller_webhook_events SET lease_until=?,attempts=attempts+1 WHERE id=?').run(lease,row.id)
      return row
    }).immediate()
    if(!job) break
    try {
      const body=JSON.stringify({id:job.id,event:job.event,data:resellerOrderForUser(job.user_id,job.order_id)})
      const timestamp=String(Math.floor(Date.now()/1000))
      await send(job.url,body,{'X-IUnlockMobile-Event-Id':job.id,'X-IUnlockMobile-Timestamp':timestamp,
        'X-IUnlockMobile-Signature':`sha256=${webhookSignature(decrypt(job.secret_encrypted),job.id,timestamp,body)}`})
      db().prepare("UPDATE reseller_webhook_events SET sent_at=datetime('now'),lease_until=0,last_error=NULL WHERE id=? AND lease_until=?").run(job.id,lease)
      stats.sent++
    }catch{
      db().prepare("UPDATE reseller_webhook_events SET lease_until=0,next_at=?,last_error='Delivery failed; retrieve the order through the API or account.' WHERE id=? AND lease_until=?")
        .run(Date.now()+Math.min(6*3600000,60000*2**job.attempts),job.id,lease)
      stats.failed++
    }
  }
  return stats
}

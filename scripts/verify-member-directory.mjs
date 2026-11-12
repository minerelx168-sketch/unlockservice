// Run against a local QA server only. Use a session from that server's disposable database.
import assert from 'node:assert/strict'
const base = new URL(process.env.MEMBER_TEST_ORIGIN || 'http://127.0.0.1:4057')
assert.equal(base.hostname, '127.0.0.1')
const session=process.env.MEMBER_TEST_SESSION
assert.ok(session)
const codes = ['966','967','780','1001','344','721','430','893','931'].map(n=>'UNLOCK_'+n)
for (const member of [false,true]) for (const agent of ['Mozilla/5.0','Googlebot']) {
  const headers={'User-Agent':agent,...(member?{Cookie:'iunlockmobile_session='+session}:{})}
  const api=await fetch(new URL('/api/user/unlock-more-services',base),{headers})
  assert.equal(api.status,member?200:401); assert.match(api.headers.get('cache-control'),/no-store/)
  if(member) { const ids=(await api.json()).services.map(p=>p.productCode); assert.equal(new Set(ids).size,ids.length); for(const id of [...codes,'UNLOCK_346']) assert.ok(ids.includes(id), id) }
  for(const path of ['/','/services/unlock/more']) for(const rsc of [false,true]){
    const r=await fetch(new URL(path,base),{headers:{...headers,...(rsc?{RSC:'1'}:{})},redirect:'manual'})
    const body=await r.text()
    if(path!=='/'&&!member) assert.match((r.headers.get('location')||'')+body,/\/login/)
    else {assert.equal(r.status,200);assert.match(r.headers.get('content-type'),rsc?/text\/x-component/:/text\/html/)}
    if(path==='/'||!member) for(const c of codes) assert.ok(!body.includes(c),c)
    else assert.match(body,/Bypass No Signal/i)
  }
}
console.log('20 visitor/member, HTML/RSC and API responses verified')

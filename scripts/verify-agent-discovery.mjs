import assert from 'node:assert/strict'
const base=process.argv[2]??'http://127.0.0.1:4291'
const forbidden=/lost|owner id|bypass|mdm|past due|bit\.ly|\b(?:CHECK|UNLOCK)_(?:718|926|25|661|904|702|696|966|967|780|1001|344|721|430|893|931|1000)\b/i
async function read(path,options){const r=await fetch(base+path,options),s=await r.text();assert.equal(r.status,200,path);assert.doesNotMatch(s,forbidden,path);console.log(r.status,path.split('?')[0],'restricted matches: 0');return {r,s}}
for(const path of ['/llms.txt','/llms-full.txt']){const {r,s}=await read(path);assert.match(r.headers.get('content-type'),/^text\/plain; charset=utf-8/i);assert.equal(r.headers.get('cache-control'),'public, max-age=3600');assert.match(s,/Apple Carrier Lite/)}
assert.equal(JSON.parse((await read('/openapi.json')).s).openapi,'3.1.0')
assert.equal(JSON.parse((await read('/api/agent/validate-imei?imei=490154203237518')).s).valid,true)
assert.equal(JSON.parse((await read('/api/agent/decode-apple-model?model=MU683LL%2FA')).s).regionCode,'LL')
assert.ok(JSON.parse((await read('/api/agent/quote')).s).offers.length>10)
assert.deepEqual(JSON.parse((await read('/api/agent/quote?carrier=1000')).s).offers,[])
await read('/api/mcp')
async function rpc(method,params={}){return JSON.parse((await read('/api/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).s)}
assert.equal((await rpc('initialize')).result.serverInfo.name,'iunlockmobile')
assert.equal((await rpc('tools/list')).result.tools.length,3)
for(const [name,args] of [['validate_imei',{imei:'490154203237518'}],['decode_apple_model',{model:'MU683LL/A'}],['quote',{country:'canada'}]])assert.ok((await rpc('tools/call',{name,arguments:args})).result.content[0].text)
assert.equal((await rpc('tools/call',{name:'private_catalog'})).error.code,-32602)

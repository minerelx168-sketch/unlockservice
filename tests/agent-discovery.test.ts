import test from 'node:test'
import assert from 'node:assert/strict'
import {invoke,quotes,discoveryText} from '../lib/agent-discovery'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
process.env.IUNLOCKMOBILE_DB=join(mkdtempSync(join(tmpdir(),'agent-test-')),'test.db')
test('agent tools separate checksum and sales region from paid device status',()=>{
 const r=invoke('validate_imei',{imei:'490154-20323751 8'})
 assert.ok('validFormat' in r && r.validFormat && r.luhnValid && r.tacPrefix==='49015420' && r.recommendedNextStep.includes('utm_campaign=carrier_check_170'))
 assert.ok('variants' in invoke('decode_apple_model',{model:'A3105'}))
 assert.ok(quotes('us','verizon').every(q=>q.serviceMode==='status_check_only'))

 assert.ok('regionCode' in invoke('decode_apple_model',{model:'MU683LL/A'}))
 assert.throws(()=>invoke('quote',{sku:'718'}))
})
test('positive catalog and metadata projection cannot publish restricted services',()=>{
 assert.match(discoveryText(false),/Canada eligible unlocks:[^;]+\$4\.99–\$26\.00/);const rows=quotes();assert.ok(rows.length>10);assert.ok(rows.some(x=>x.sku==='APPLE_CARRIER_LITE'&&x.card===1.79))
 for(const q of ['718','1000','MDM','Owner ID','Past Due'])assert.deepEqual(quotes('',q),[])
 for(const value of [discoveryText(true),discoveryText(false),JSON.stringify(rows)])assert.doesNotMatch(value,/lost|owner id|bypass|mdm|past due|bit\.ly|providerCost|UNLOCK_(718|1000)\b/i)
})

test('MCP lists the public read-only Action equivalents',async()=>{
 const {POST}=await import('../app/api/mcp/route')
 const res=await POST(new Request('https://iunlockmobile.com/api/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}))
 const data=await res.json()
 assert.deepEqual(data.result.tools.map((t:{name:string})=>t.name),['validate_imei','decode_apple_model','get_service_quote'])
})

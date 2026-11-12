import test from 'node:test'
import assert from 'node:assert/strict'
import {invoke,quotes,discoveryText} from '../lib/agent-discovery'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
process.env.IUNLOCKMOBILE_DB=join(mkdtempSync(join(tmpdir(),'agent-test-')),'test.db')
test('agent tools separate checksum and sales region from paid device status',()=>{
 assert.deepEqual(invoke('validate_imei',{imei:'490154203237518'}),{valid:true,tac:'49015420',modelHint:null,scope:'Checksum only; not proof of identity or carrier status.',carrierCheck:'https://iunlockmobile.com/services/imei-check/apple-carrier-lock-status'})
 assert.ok('regionCode' in invoke('decode_apple_model',{model:'MU683LL/A'}))
 assert.throws(()=>invoke('quote',{sku:'718'}))
})
test('positive catalog and metadata projection cannot publish restricted services',()=>{
 assert.match(discoveryText(false),/Canada eligible unlocks:[^;]+\$4\.99–\$26\.00/);const rows=quotes();assert.ok(rows.length>10);assert.ok(rows.some(x=>x.sku==='APPLE_CARRIER_LITE'&&x.card===1.79))
 for(const q of ['718','1000','MDM','Owner ID','Past Due'])assert.deepEqual(quotes('',q),[])
 for(const value of [discoveryText(true),discoveryText(false),JSON.stringify(rows)])assert.doesNotMatch(value,/lost|owner id|bypass|mdm|past due|bit\.ly|providerCost|UNLOCK_(718|1000)\b/i)
})

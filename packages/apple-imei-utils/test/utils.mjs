import test from 'node:test'
import assert from 'node:assert/strict'
import {decodeAppleModelNumber as d,extractTac as tac,validateImeiLuhn as valid,luhnSteps} from '../dist/index.js'
test('checksum and TAC preserve zeroes and reject malformed or empty input',()=>{
 for(const x of ['','490154203237519','000000000000000','49015420323751a','4901542032375189']){assert.equal(valid(x),false);assert.equal(tac(x),null)}
 assert.equal(valid('490154203237518'),true);assert.equal(tac('490154203237518'),'49015420');assert.equal(luhnSteps('490154203237518').reduce((a,b)=>a+b),60)
})
test('part hints distinguish market, origin, unknown and hardware A-number',()=>{
 for(const [s,h] of [['MU683LL/A','Retail'],['FNCX3VC/A','Refurbished'],['NT9F2J/A','Service replacement'],['P1234BZ/A','Personalized'],['31234BR/A','Possible demonstration unit (unverified)']])assert.equal(d(s).origin,h)
 for(const suffix of ['LL','VC','J','B','ZD','E','BR','BZ','AE','AB','CH','ZP','TH'])assert.ok(d('M1234'+suffix+'/A').region)
 assert.equal(d(' m1234ll/a ').region,'United States');assert.equal(d('A2649'),null);assert.equal(d('X1234XX/A').region,null);assert.equal(d('X1234XX/A').origin,null)
})

import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const dir=mkdtempSync(join(tmpdir(),'capture-diagnostics-'))
process.env.IUNLOCKMOBILE_DB=join(dir,'test.db')
after(()=>rmSync(dir,{recursive:true,force:true}))
test('capture diagnostics distinguish consent and absent IDs without storing identifiers or sending events',async()=>{
 const {db}=await import('../lib/db')
 const {recordTrackingCapture}=await import('../lib/tracking-diagnostics')
 const user=Number(db().prepare("INSERT INTO users(username,email,password_hash) VALUES('customer','test@example.test','unused')").run().lastInsertRowid)
 recordTrackingCapture('topup','one',user,undefined,false)
 recordTrackingCapture('topup','two',user,undefined,true)
 recordTrackingCapture('topup','three',user,{clientId:'123.456',sessionId:'123'},true)
 recordTrackingCapture('topup','four',user,{clientId:'123.456',sessionId:'123'},true,false)
 recordTrackingCapture('topup','one',user,{clientId:'123.456',sessionId:'123'},true)
 const rows=db().prepare('SELECT reason FROM tracking_capture_diagnostics ORDER BY rowid').all()
 assert.deepEqual(rows,[{reason:'consent_not_granted'},{reason:'browser_context_missing'},{reason:'context_received'},{reason:'server_tracking_disabled'}])
 assert.equal(JSON.stringify(db().prepare('SELECT * FROM tracking_capture_diagnostics').all()).includes('123.456'),false)
 db().prepare("UPDATE users SET account_type='admin' WHERE id=?").run(user)
 recordTrackingCapture('topup','admin',user,undefined,true)
 assert.equal((db().prepare('SELECT COUNT(*) n FROM tracking_capture_diagnostics').get() as {n:number}).n,4)
})

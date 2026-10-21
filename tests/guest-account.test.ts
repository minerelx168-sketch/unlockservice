import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test,{before,after} from 'node:test'
const directory=mkdtempSync(join(tmpdir(),'guest-account-'))
Object.assign(process.env,{IUNLOCKMOBILE_DB:join(directory,'test.db'),IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET:'guest-account-security-test-secret-32-characters'})
let identity:typeof import('../lib/guest-account'),database:typeof import('../lib/db'),auth:typeof import('../lib/auth')
before(async()=>{identity=await import('../lib/guest-account');database=await import('../lib/db');auth=await import('../lib/auth')})
after(()=>{database.db().close();rmSync(directory,{recursive:true,force:true})})
function order(email=`${randomBytes(8).toString('hex')}@example.test`,state='paid') {
  const reference=randomBytes(16).toString('hex')
  database.db().prepare(`INSERT INTO guest_checkouts(reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,account_id,product_id,environment,state,payment_id,paid_at)
    VALUES (?,?,?,'APPLE_BASIC','Test report','test-only',1000,50,'biz_test','prod_test','test',?,?,?)`)
    .run(reference,reference,email,state,state==='pending'?null:`pay_${reference}`,state==='pending'?null:new Date().toISOString())
  return {reference,email}
}
function activation(reference:string) {
  const path=identity.prepareGuestAccount(reference)
  assert.ok(path)
  return new URL(path,'https://iunlockmobile.com').searchParams.get('token')!
}
function account(email:string) {
  return database.db().prepare('SELECT * FROM users WHERE email=?').get(email) as {id:number;email_verified_at:string|null;password_hash:string;account_type:string;status:string}
}

test('account creation is paid-only, password-disabled, unverified, and exposes no account via the tracking capability',()=>{
  const pending=order(undefined,'pending')
  assert.equal(identity.prepareGuestAccount(pending.reference),null)
  assert.equal(account(pending.email),undefined)
  const paid=order(),token=activation(paid.reference),profile=account(paid.email)
  assert.equal(profile.password_hash,'!guest-email-activation');assert.equal(profile.email_verified_at,null)
  assert.equal(profile.account_type,'customer');assert.equal(profile.status,'active')
  assert.equal(identity.listClaimedGuestOrders(profile.id).length,0)
  assert.equal(identity.guestAccountActivation(paid.reference,'0'.repeat(64)),null)
  const trackingKey=createHmac('sha256',process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET!).update(`guest-order:v1:${paid.reference}`).digest('hex')
  assert.equal(identity.guestAccountActivation(paid.reference,trackingKey),null,'valid order capability cannot activate customer account')
  assert.equal(identity.guestAccountActivation(paid.reference,token)?.requiresSignIn,false)
  assert.equal(identity.prepareGuestAccount(paid.reference)?.includes(token),true)
  assert.equal(account(paid.email).email_verified_at,null,'read-only email scanner does not activate')
  assert.deepEqual(database.db().prepare('SELECT COUNT(*) AS total FROM sessions WHERE user_id=?').get(profile.id),{total:0})
})

test('new customer activates without password, token is single-use, order remains financially isolated',()=>{
  const paid=order(),token=activation(paid.reference),user=identity.activateGuestAccount(paid.reference,token)
  assert.ok(user.email_verified_at);assert.equal(user.account_type,'customer')
  assert.equal(identity.listClaimedGuestOrders(user.id)[0]?.reference,paid.reference)
  assert.equal(account(paid.email).password_hash,'!guest-email-activation')
  assert.throws(()=>identity.activateGuestAccount(paid.reference,token),/expired|used/)
  assert.equal(identity.prepareGuestAccount(paid.reference)?.includes(token),true,'delivery retries retain the same unusable-after-consumption URL')
  assert.deepEqual(database.db().prepare('SELECT user_id,report_id FROM guest_checkouts WHERE reference=?').get(paid.reference),{user_id:null,report_id:null})
  assert.deepEqual(database.db().prepare('SELECT COUNT(*) AS total FROM credit_ledger WHERE user_id=?').get(user.id),{total:0})
})

test('password is optional and can be chosen during new profile activation',()=>{
  const paid=order(),token=activation(paid.reference)
  assert.throws(()=>identity.activateGuestAccount(paid.reference,token,'short'),/at least 8/)
  const user=identity.activateGuestAccount(paid.reference,token,'chosen-passphrase')
  assert.ok(user.email_verified_at);assert.equal(auth.verifyPassword('chosen-passphrase',account(paid.email).password_hash),true)
})

test('legacy existing profile requires both inbox token and matching session, never grants account on email match',()=>{
  const email=`legacy-${randomBytes(8).toString('hex')}@example.test`
  const info=database.db().prepare("INSERT INTO users(username,email,password_hash,email_verified_at) VALUES (?,?,?,datetime('now'))")
    .run(`legacy-${randomBytes(8).toString('hex')}`,email,auth.hashPassword('attacker-precreated-password'))
  const userId=Number(info.lastInsertRowid),oldSession=auth.createSession(userId),paid=order(email),token=activation(paid.reference)
  assert.equal(identity.guestAccountActivation(paid.reference,token)?.requiresSignIn,true)
  assert.throws(()=>identity.activateGuestAccount(paid.reference,token),/Sign in to your existing account/)
  assert.throws(()=>identity.activateGuestAccount(paid.reference,token,undefined,userId+5000),/Sign in/)
  assert.equal(identity.listClaimedGuestOrders(userId).length,0,'pre-existing attacker account never gains new order')
  assert.ok(database.db().prepare('SELECT 1 FROM sessions WHERE id=?').get(oldSession.id),'existing account is not modified before proof')
  // A real existing customer can opt in with both independent proofs. Password remains unchanged.
  const user=identity.activateGuestAccount(paid.reference,token,undefined,userId)
  assert.equal(user.id,userId);assert.equal(identity.listClaimedGuestOrders(userId)[0].reference,paid.reference)
  assert.equal(auth.verifyPassword('attacker-precreated-password',account(email).password_hash),true)
})

test('unverified legacy account cannot retain previous password, OTP or sessions after inbox claim with matching session',()=>{
  const email=`unverified-${randomBytes(8).toString('hex')}@example.test`
  const id=Number(database.db().prepare('INSERT INTO users(username,email,password_hash,email_verified_at) VALUES (?,?,?,NULL)')
    .run(`pending-${randomBytes(8).toString('hex')}`,email,auth.hashPassword('old-password')).lastInsertRowid)
  const session=auth.createSession(id),paid=order(email),token=activation(paid.reference)
  database.db().prepare("INSERT INTO email_verifications(user_id,code_hash,purpose,expires_at) VALUES (?,'test','reset',datetime('now','+1 hour'))").run(id)
  assert.throws(()=>identity.activateGuestAccount(paid.reference,token),/Sign in/)
  identity.activateGuestAccount(paid.reference,token,undefined,id)
  assert.equal(auth.verifyPassword('old-password',account(email).password_hash),false)
  assert.equal(database.db().prepare('SELECT 1 FROM sessions WHERE id=?').get(session.id),undefined)
  assert.equal(database.db().prepare('SELECT 1 FROM email_verifications WHERE user_id=? AND consumed_at IS NULL').get(id),undefined)
})

test('admin, banned, email changes, pending disputes, expired and cross-order tokens fail closed',()=>{
  const adminEmail=`admin-${randomBytes(8).toString('hex')}@example.test`
  const admin=Number(database.db().prepare("INSERT INTO users(username,email,password_hash,account_type,email_verified_at) VALUES (?,?,'disabled','admin',datetime('now'))")
    .run(`admin-${randomBytes(8).toString('hex')}`,adminEmail).lastInsertRowid)
  const adminOrder=order(adminEmail);assert.equal(identity.prepareGuestAccount(adminOrder.reference),null)
  assert.equal(identity.listClaimedGuestOrders(admin).length,0)
  const paid=order(),token=activation(paid.reference),other=order()
  assert.equal(identity.guestAccountActivation(other.reference,token),null)
  database.db().prepare("UPDATE users SET banned_at=datetime('now') WHERE email=?").run(paid.email)
  assert.equal(identity.guestAccountActivation(paid.reference,token),null)
  database.db().prepare('UPDATE users SET banned_at=NULL WHERE email=?').run(paid.email)
  database.db().prepare("UPDATE guest_account_access SET expires_at=datetime('now','-1 day') WHERE reference=?").run(paid.reference)
  assert.equal(identity.guestAccountActivation(paid.reference,token),null)
  const changed=order(),changedToken=activation(changed.reference)
  database.db().prepare("UPDATE guest_checkouts SET email='different@example.test' WHERE reference=?").run(changed.reference)
  assert.equal(identity.guestAccountActivation(changed.reference,changedToken),null)
  const pending=order(undefined,'pending')
  database.db().prepare("UPDATE guest_checkouts SET paid_at=datetime('now'),payment_id=?,review_reason='dispute' WHERE reference=?").run(`pay_${pending.reference}`,pending.reference)
  assert.equal(identity.prepareGuestAccount(pending.reference),null)
})

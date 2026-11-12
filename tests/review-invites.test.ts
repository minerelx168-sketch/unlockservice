import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {candidates,reviewUrl} from '../lib/review-invites'
test('review eligibility uses delivery time and excludes reversals',()=>{
 const db=new Database(':memory:')
 db.exec(`CREATE TABLE orders(id,user_id,delivery_email,status,provider_mode,price_cents);CREATE TABLE users(id,email);
 CREATE TABLE order_notifications(resource_type,resource_id,event,sent_at,last_error);
 CREATE TABLE credit_ledger(ref_type,ref_id,type);
 CREATE TABLE paid_report_orders(id,status);
 CREATE TABLE guest_checkouts(reference,email,result_sent_at,report_id,state,environment,payment_id,paid_at,price_cents,review_reason,refund_requested_at,refund_notice_sent_at);
 INSERT INTO paid_report_orders VALUES(1,'completed');
 INSERT INTO guest_checkouts VALUES('G',' TEST@example.com ',datetime('now','-3 hours'),1,'completed','live','p',datetime('now'),170,NULL,NULL,NULL)`)
 const select=db.prepare('SELECT email FROM ('+candidates+") WHERE delivered BETWEEN datetime('now','-6 hours') AND datetime('now','-2 hours')")
 assert.deepEqual(select.all(),[{email:'test@example.com'}])
 for(const sql of ["state='refunded'","state='pending'","result_sent_at=datetime('now','-7 hours')","result_sent_at=datetime('now','-1 hour')","price_cents=0","refund_requested_at=datetime('now')","environment='sandbox'"]){
 db.exec('SAVEPOINT t; UPDATE guest_checkouts SET '+sql);assert.equal(select.all().length,0);db.exec('ROLLBACK TO t; RELEASE t')}
 db.exec("INSERT INTO credit_ledger VALUES('paid_imei_report','1','refund')");assert.equal(select.all().length,0);db.close()
})
test('review links must point to an actual listing without tracking',()=>{assert.equal(reviewUrl('https://alternativeto.net/software/example/'),'https://alternativeto.net/software/example/');for(const v of [undefined,'bad','https://alternativeto.net/','https://elsewhere.com/software/test/'])assert.equal(reviewUrl(v),null)})

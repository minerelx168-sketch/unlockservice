import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { customerTime, customerTimestamp, localTodayOrders, validTimeZone } from '../lib/customer-time'

test('SQLite UTC and ISO offsets describe the same instant regardless of the server timezone', () => {
  const before = process.env.TZ
  try {
    for (const zone of ['UTC', 'Asia/Bangkok', 'America/Los_Angeles']) {
      process.env.TZ = zone
      for (const value of ['2026-10-19 06:15:00', '2026-10-19T06:15:00', '2026-10-19T06:15:00Z', '2026-10-19T13:15:00+07:00', '2026-10-18T23:15:00-0700']) {
        assert.equal(customerTimestamp(value), '2026-10-19T06:15:00.000Z')
      }
    }
  } finally {
    if (before === undefined) delete process.env.TZ
    else process.env.TZ = before
  }
})

test('the same payment shows its local date, time and offset in each customer timezone', () => {
  const utc = '2026-10-19 06:15:00'
  assert.match(customerTime(utc, 'Asia/Bangkok')!.text, /Oct 19, 2026.*1:15 PM GMT\+7/)
  assert.match(customerTime(utc, 'America/Los_Angeles')!.text, /Oct 18, 2026.*11:15 PM GMT-7/)
  assert.match(customerTime(utc, 'Asia/Kathmandu')!.text, /Oct 19, 2026.*12:00 PM GMT\+5:45/)
  assert.match(customerTime(utc, 'Pacific/Auckland')!.text, /Oct 19, 2026.*7:15 PM GMT\+13/)
})

test('daylight-saving changes use the offset at the transaction time, including repeated hours', () => {
  assert.match(customerTime('2026-03-08 06:30:00', 'America/New_York')!.text, /1:30 AM GMT-5/)
  assert.match(customerTime('2026-03-08 07:30:00', 'America/New_York')!.text, /3:30 AM GMT-4/)
  assert.match(customerTime('2026-11-01 05:30:00', 'America/New_York')!.text, /1:30 AM GMT-4/)
  assert.match(customerTime('2026-11-01 06:30:00', 'America/New_York')!.text, /1:30 AM GMT-5/)
})

test('membership dates cross midnight locally while calendar-only editorial dates are not parsed', () => {
  assert.equal(customerTime('2026-10-19 00:15:00', 'America/Los_Angeles', true)!.text, 'Oct 18, 2026')
  assert.equal(customerTimestamp('2026-10-19'), null)
  assert.equal(customerTimestamp('2024-02-29 23:59:59.123456'), '2024-02-29T23:59:59.123Z')
})

test('missing, malformed and impossible timestamps are safe to render', () => {
  for (const value of [null, undefined, '', 'not a date', '2026-02-30 12:00:00', '2026-13-01 12:00:00', '2026-01-01 24:00:00', '2026-01-01 12:60:00', '2026-01-01 12:00:61', '2026-01-01 12:00:00+99:00']) {
    assert.equal(customerTimestamp(value), null)
    assert.equal(customerTime(value, 'Asia/Bangkok'), null)
  }
})

test('unknown timezone falls back to clearly labelled UTC without altering the instant', () => {
  assert.equal(validTimeZone('Not/AZone'), 'UTC')
  assert.equal(validTimeZone(undefined), 'UTC')
  const time = customerTime('2026-10-19 06:15:00', 'Not/AZone')!
  assert.equal(time.iso, '2026-10-19T06:15:00.000Z')
  assert.match(time.text, /6:15 AM GMT/)
  assert.equal(time.title, 'UTC · 2026-10-19 06:15:00 UTC')
})

test('Placed today follows the customer calendar instead of UTC midnight', () => {
  const buckets = [
    { at: '2026-10-18 06:00:00', count: 4 },
    { at: '2026-10-18 16:59:00', count: 1 },
    { at: '2026-10-18 17:00:00', count: 2 },
    { at: '2026-10-19 06:00:00', count: 3 },
  ]
  const now = Date.parse('2026-10-19T06:15:00Z')
  assert.equal(localTodayOrders(buckets, 'Asia/Bangkok', now), 5)
  assert.equal(localTodayOrders(buckets, 'America/Los_Angeles', now), 6)
  assert.equal(localTodayOrders(buckets, 'UTC', now), 3)
  // A 25-hour autumn day includes both occurrences of the repeated hour.
  assert.equal(localTodayOrders([
    { at: '2026-11-01 05:30:00', count: 2 },
    { at: '2026-11-01 06:30:00', count: 3 },
    { at: '2026-11-02 04:59:00', count: 4 },
  ], 'America/New_York', Date.parse('2026-11-02T04:59:30Z')), 9)
})

test('recent order counts are read-only, scoped to the account and grouped without private details', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'customer-time-'))
  const previous = process.env.IUNLOCKMOBILE_DB
  process.env.IUNLOCKMOBILE_DB = join(directory, 'test.db')
  const { db } = await import('../lib/db')
  const { recentOrderCounts } = await import('../lib/orders')
  const connection = db()
  try {
    const users = connection.prepare("INSERT INTO users(username,email,password_hash) VALUES (?,?,'synthetic')")
    const owner = Number(users.run('local-time-owner', 'owner@example.test').lastInsertRowid)
    const other = Number(users.run('local-time-other', 'other@example.test').lastInsertRowid)
    connection.prepare("INSERT OR IGNORE INTO carriers(id,name,country,price_cents,eta_hours) VALUES (1,'Example','US',500,1)").run()
    const insert = connection.prepare("INSERT INTO orders(user_id,kind,carrier_id,imei,delivery_email,delivery,status,price_cents,eta_hours,created_at) VALUES (?,'carrier_unlock',1,'PRIVATE-DEVICE','private@example.test','code','processing',500,1,?)")
    insert.run(owner, '2026-10-19 06:15:00')
    insert.run(owner, '2026-10-19T13:15:10+07:00')
    insert.run(other, '2026-10-19 06:15:00')
    insert.run(owner, '2026-10-16 06:15:00')
    insert.run(owner, '2026-10-20 06:15:00')
    assert.deepEqual(recentOrderCounts(owner, Date.parse('2026-10-19T06:16:00Z')), [{ at: '2026-10-19 06:15:00', count: 2 }])
    assert.deepEqual(recentOrderCounts(other, Date.parse('2026-10-19T06:16:00Z')), [{ at: '2026-10-19 06:15:00', count: 1 }])
    assert.equal((connection.prepare('SELECT count(*) AS n FROM orders').get() as { n: number }).n, 5)
    assert.equal((connection.prepare('SELECT count(*) AS n FROM credit_ledger').get() as { n: number }).n, 0)
  } finally {
    connection.close()
    if (previous === undefined) delete process.env.IUNLOCKMOBILE_DB
    else process.env.IUNLOCKMOBILE_DB = previous
    rmSync(directory, { recursive: true, force: true })
  }
})

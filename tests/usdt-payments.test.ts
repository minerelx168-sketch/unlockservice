import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before, beforeEach } from 'node:test'

/*
 * USDT detection against a fake BNB Smart Chain: a JSON-RPC endpoint served
 * from memory through a stubbed fetch, so every path — scan, code match,
 * confirmations, hash claims, the administrator's decisions — runs end to
 * end without a network.
 */

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-usdt-'))
const WALLET = '0x2222222222222222222222222222222222222222'
const STRANGER = '0x9999999999999999999999999999999999999999'
const USDT = '0x55d398326f99059ff775485246999027b3197955'
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

process.env.IUNLOCKMOBILE_DB = join(workDir, 'usdt.db')
process.env.IUNLOCKMOBILE_USDT_BEP20_ADDRESS = WALLET
process.env.IUNLOCKMOBILE_BSC_RPC_URL = 'http://fake-bsc.test/rpc'
process.env.IUNLOCKMOBILE_USDT_CONFIRMATIONS = '3'
process.env.IUNLOCKMOBILE_USDT_SCAN_START_BLOCK = '900'
process.env.IUNLOCKMOBILE_USDT_SHORTFALL_TOLERANCE_CENTS = '100'
delete process.env.IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION

/* ---- the fake chain ------------------------------------------------------ */

type FakeLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  logIndex: string
}

const chain = {
  chainId: 56,
  head: 1_000,
  logs: [] as FakeLog[],
  blockTimes: new Map<number, number>(),
  receipts: new Map<string, { status: string; blockNumber: string; logs: FakeLog[] }>(),
}
let hashCounter = 0

const hex = (value: number | bigint) => `0x${value.toString(16)}`
const topic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, '0')}`

function units(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.')
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
}

function e4ToAmount(e4: number): string {
  return `${Math.floor(e4 / 10_000)}.${String(e4 % 10_000).padStart(4, '0')}`
}

/** Puts a USDT transfer on the chain and returns its hash. */
function send(amount: string, options: { block?: number; secondsAgo?: number; to?: string } = {}): string {
  const block = options.block ?? chain.head + 1
  hashCounter += 1
  const txHash = `0x${hashCounter.toString(16).padStart(64, 'a')}`
  const log: FakeLog = {
    address: USDT,
    topics: [TRANSFER, topic(STRANGER), topic(options.to ?? WALLET)],
    data: hex(units(amount)),
    blockNumber: hex(block),
    transactionHash: txHash,
    logIndex: '0x0',
  }
  chain.logs.push(log)
  chain.receipts.set(txHash, { status: '0x1', blockNumber: hex(block), logs: [log] })
  // By default the block lands a couple of seconds from now, the way a real
  // payment arrives some time after the invoice that asked for it.
  chain.blockTimes.set(block, Math.floor(Date.now() / 1000) - (options.secondsAgo ?? -2))
  chain.head = Math.max(chain.head, block)
  return txHash
}

/** One transaction carrying several USDT transfers into the wallet. */
function sendMany(amounts: string[]): string {
  const block = chain.head + 1
  hashCounter += 1
  const txHash = `0x${hashCounter.toString(16).padStart(64, 'd')}`
  const logs = amounts.map((amount, index) => ({
    address: USDT,
    topics: [TRANSFER, topic(STRANGER), topic(WALLET)],
    data: hex(units(amount)),
    blockNumber: hex(block),
    transactionHash: txHash,
    logIndex: hex(index),
  }))
  chain.logs.push(...logs)
  chain.receipts.set(txHash, { status: '0x1', blockNumber: hex(block), logs })
  chain.blockTimes.set(block, Math.floor(Date.now() / 1000) + 2)
  chain.head = block
  return txHash
}

function mine(blocks: number) {
  chain.head += blocks
}

const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (!url.startsWith('http://fake-bsc.test') && !url.startsWith('http://wrong-chain.test')) {
    return originalFetch(input, init)
  }
  const { id, method, params } = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] }
  let result: unknown
  switch (method) {
    case 'eth_chainId':
      result = hex(url.startsWith('http://wrong-chain.test') ? 1 : chain.chainId)
      break
    case 'eth_blockNumber':
      result = hex(chain.head)
      break
    case 'eth_getLogs': {
      const [filter] = params as Array<{ fromBlock: string; toBlock: string; address: string; topics: Array<string | null> }>
      const from = Number.parseInt(filter.fromBlock, 16)
      const to = Number.parseInt(filter.toBlock, 16)
      result = chain.logs.filter((log) => {
        const block = Number.parseInt(log.blockNumber, 16)
        return block >= from && block <= to && log.address === filter.address && log.topics[2] === filter.topics[2]
      })
      break
    }
    case 'eth_getBlockByNumber': {
      const block = Number.parseInt((params as string[])[0], 16)
      const time = chain.blockTimes.get(block) ?? Math.floor(Date.now() / 1000)
      result = { timestamp: hex(time) }
      break
    }
    case 'eth_getTransactionReceipt':
      result = chain.receipts.get((params as string[])[0]) ?? null
      break
    default:
      return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { message: `no ${method}` } }))
  }
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    headers: { 'content-type': 'application/json' },
  })
}) as typeof fetch

/* ---- the app ------------------------------------------------------------- */

let auth: typeof import('../lib/auth')
let payments: typeof import('../lib/payments')
let usdt: typeof import('../lib/usdt')
let credits: typeof import('../lib/credits')
let bsc: typeof import('../lib/bsc')
let database: typeof import('../lib/db')
let userCount = 0

function newUser() {
  userCount += 1
  return auth.register(`payer${userCount}`, `payer${userCount}@example.test`, 'correct-horse-battery-staple')
}

before(async () => {
  auth = await import('../lib/auth')
  payments = await import('../lib/payments')
  usdt = await import('../lib/usdt')
  credits = await import('../lib/credits')
  bsc = await import('../lib/bsc')
  database = await import('../lib/db')
})

beforeEach(() => {
  process.env.IUNLOCKMOBILE_BSC_RPC_URL = 'http://fake-bsc.test/rpc'
})

after(() => {
  globalThis.fetch = originalFetch
  rmSync(workDir, { recursive: true, force: true })
})

async function scan() {
  const result = await usdt.scanUsdtTransfers({ force: true })
  assert.equal(result.status, 'ok', JSON.stringify(result))
  return result
}

/* ---- tests ----------------------------------------------------------------- */

test('every invoice asks for a coded amount, and invoices near each other never share a code', () => {
  const codes = new Set<number>()
  for (let index = 0; index < 12; index += 1) {
    const invoice = payments.createInvoice(newUser().id, 'crypto_networks', 2500)
    assert.ok(invoice.pay_amount_e4! > 250_000 && invoice.pay_amount_e4! < 250_100, String(invoice.pay_amount_e4))
    codes.add(payments.paymentCode(invoice.pay_amount_e4!))
  }
  assert.equal(codes.size, 12)

  const user = newUser()
  const first = payments.createInvoice(user.id, 'crypto_networks', 2500)
  const again = payments.createInvoice(user.id, 'crypto_networks', 2500)
  assert.equal(again.reference, first.reference, 'reopening the same unpaid top-up reuses its code')
})

test('a transfer carrying the code settles its invoice — no transaction id, no person', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 2500)
  send(e4ToAmount(invoice.pay_amount_e4!))
  mine(5)

  const result = await scan()
  assert.equal(result.status === 'ok' && result.settled, 1)
  const settled = payments.getInvoice(invoice.reference, user.id)!
  assert.equal(settled.status, 'success')
  assert.equal(settled.credited_cents, 2500)
  assert.equal(settled.received_e4, invoice.pay_amount_e4)
  assert.match(settled.payment_reference!, /^0x[0-9a-f]{64}$/)
  assert.equal(credits.getBalance(user.id).creditCents, 2500)

  await scan()
  assert.equal(credits.getBalance(user.id).creditCents, 2500, 'a second scan never credits twice')
})

test('an exchange that keeps its withdrawal fee out of the amount still lands the payment in full', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 4000)
  send(e4ToAmount(invoice.pay_amount_e4! - 2_900)) // 0.29 USDT kept by the exchange
  mine(5)
  await scan()

  const settled = payments.getInvoice(invoice.reference, user.id)!
  assert.equal(settled.status, 'success')
  assert.equal(settled.credited_cents, 4000)
})

test('a real shortfall credits what arrived instead of stranding the invoice', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 5000)
  send(e4ToAmount(invoice.pay_amount_e4! - 25_000)) // 2.50 USDT short
  mine(5)
  await scan()

  const settled = payments.getInvoice(invoice.reference, user.id)!
  assert.equal(settled.status, 'success')
  assert.equal(settled.credited_cents, 4750)
  assert.equal(credits.getBalance(user.id).creditCents, 4750)
})

test('an overpayment is credited, not kept; the fee allowance is capped so it is never a discount to farm', () => {
  const invoice = { credit_amount_cents: 2500, total_due_cents: 2500, fee_cents: 0, pay_amount_e4: 250_037 }
  assert.equal(payments.creditForTransfer(invoice, 250_037), 2500)
  assert.equal(payments.creditForTransfer(invoice, 300_037), 3000)
  // $25: allowance is min($1.00, 3%) = 75 cents.
  assert.equal(payments.creditForTransfer(invoice, 245_000), 2500) // 51 cents short
  assert.equal(payments.creditForTransfer(invoice, 240_000), 2400) // $1.01 short
  assert.equal(payments.creditForTransfer(invoice, 200_000), 2000)

  // $5 paid a dollar short is not "a fee": 3% of $5 is 15 cents.
  const small = { credit_amount_cents: 500, total_due_cents: 500, fee_cents: 0, pay_amount_e4: 50_037 }
  assert.equal(payments.creditForTransfer(small, 40_037), 400)
  assert.equal(payments.creditForTransfer(small, 48_637), 500)
})

test('a transfer is not counted until it is buried under enough blocks', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 1500)
  send(e4ToAmount(invoice.pay_amount_e4!))
  mine(1)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')

  mine(5)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
})

test('a transfer sent before the invoice existed never pays it', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 6500)
  send(e4ToAmount(invoice.pay_amount_e4!), { secondsAgo: 3_600 })
  mine(5)
  await scan()

  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')
  assert.ok(usdt.unmatchedTransfers().some((row) => row.amount_e4 === invoice.pay_amount_e4))
})

test('a coded transfer pasted by hash settles on the spot, and only once', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 1200)
  const txHash = send(e4ToAmount(invoice.pay_amount_e4!))
  mine(5)

  // Pasted without its 0x, the way some exchanges show it.
  const result = await usdt.claimTransfer(invoice.reference, user.id, txHash.slice(2).toUpperCase())
  assert.equal(result.outcome, 'credited')
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')

  const second = payments.createInvoice(user.id, 'crypto_networks', 1300)
  await assert.rejects(usdt.claimTransfer(second.reference, user.id, txHash), /already credited to your invoice/)
  assert.equal(credits.getBalance(user.id).creditCents, 1200)
})

test('an uncoded transfer is attached as evidence; only an administrator credits it', async () => {
  const owner = newUser()
  const invoice = payments.createInvoice(owner.id, 'crypto_networks', 3000)
  const txHash = send('30.00') // rounded: the code is gone
  mine(5)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, owner.id)!.status, 'pending')

  const claim = await usdt.claimTransfer(invoice.reference, owner.id, `https://bscscan.com/tx/${txHash}`)
  assert.equal(claim.outcome, 'review')
  assert.equal(payments.getInvoice(invoice.reference, owner.id)!.status, 'review')
  assert.equal(credits.getBalance(owner.id).creditCents, 0, 'a claim alone never credits')

  /* Every transfer into the wallet is public. Someone else pasting it gets
     nothing by themselves — both invoices go to a person, side by side. */
  const thief = newUser()
  const theirs = payments.createInvoice(thief.id, 'crypto_networks', 3000)
  const disputed = await usdt.claimTransfer(theirs.reference, thief.id, txHash)
  assert.equal(disputed.outcome, 'review')
  assert.match(disputed.message, /another invoice points at it too/)
  assert.equal(credits.getBalance(thief.id).creditCents, 0)

  const queue = usdt.invoicesNeedingReview()
  const row = queue.find((entry) => entry.reference === invoice.reference)!
  assert.equal(row.transfer_tx_hash, txHash)
  assert.match(row.rivals!, new RegExp(thief.username))
  assert.equal(row.transfer_from, STRANGER)
  assert.ok(queue.some((entry) => entry.reference === theirs.reference && entry.rivals?.includes(owner.username)))

  const admin = newUser()
  const confirmed = await usdt.adminConfirmInvoice(admin.id, invoice.reference, row.transfer_id!)
  assert.equal(confirmed.status, 'success')
  assert.equal(confirmed.credited_cents, 3000)
  assert.equal(credits.getBalance(owner.id).creditCents, 3000)
  const loser = payments.getInvoice(theirs.reference, thief.id)!
  assert.equal(loser.status, 'pending', 'the rival claim goes back to unpaid, not left looking like evidence')
  assert.equal(loser.payment_reference, null)
  await assert.rejects(usdt.adminConfirmInvoice(admin.id, theirs.reference), /points at no payment/)
  const audit = database
    .db()
    .prepare('SELECT confirmed_by_user_id AS id FROM invoices WHERE reference = ?')
    .get(invoice.reference) as { id: number }
  assert.equal(audit.id, admin.id)
})

test('an administrator can settle an unmatched transfer against a suggested invoice, or dismiss it', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 7000)
  send('70.10')
  send('3.00')
  mine(5)
  await scan()

  const unmatched = usdt.unmatchedTransfers()
  const near = unmatched.find((row) => row.amount_e4 === 701_000)!
  assert.ok(near.candidates.some((candidate) => candidate.reference === invoice.reference))
  await usdt.adminConfirmInvoice(newUser().id, invoice.reference, near.id)
  // The asked amount includes the code, so 70.10 against 70.00xx is 9 cents over.
  assert.equal(
    payments.getInvoice(invoice.reference, user.id)!.credited_cents,
    7000 + Math.floor((701_000 - invoice.pay_amount_e4!) / 100),
  )

  const stray = usdt.unmatchedTransfers().find((row) => row.amount_e4 === 30_000)!
  usdt.adminDismissTransfer(stray.id, 'test transfer from our own wallet')
  assert.ok(!usdt.unmatchedTransfers().some((row) => row.id === stray.id))
})

test('dismissing a claimed transfer sends the invoice back to waiting, with the reason', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 8000)
  const txHash = send('80.00')
  mine(5)
  await usdt.claimTransfer(invoice.reference, user.id, txHash)
  const transfer = usdt.invoicesNeedingReview().find((row) => row.reference === invoice.reference)!

  usdt.adminDismissTransfer(transfer.transfer_id!, 'refunded to sender')
  const after = payments.getInvoice(invoice.reference, user.id)!
  assert.equal(after.status, 'pending')
  assert.match(after.note!, /refunded to sender/)
})

test('claims that point at the wrong thing are refused with a reason the customer can act on', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 900)

  await assert.rejects(usdt.claimTransfer(invoice.reference, user.id, 'my payment'), /not a BNB Smart Chain transaction ID/)
  await assert.rejects(
    usdt.claimTransfer(invoice.reference, user.id, `0x${'b'.repeat(64)}`),
    /cannot find this transaction on BNB Smart Chain/,
  )
  const elsewhere = send('9.00', { to: STRANGER })
  mine(5)
  await assert.rejects(usdt.claimTransfer(invoice.reference, user.id, elsewhere), /did not send USDT to our address/)
})

test('the watcher refuses an RPC that is not BNB Smart Chain, and says so', async () => {
  process.env.IUNLOCKMOBILE_BSC_RPC_URL = 'http://wrong-chain.test/rpc'
  const result = await usdt.scanUsdtTransfers({ force: true })
  assert.equal(result.status, 'error')
  assert.match(usdt.watcherHealth().lastError!, /not BNB Smart Chain/)
})

test('scans do not overlap and a quiet watcher is throttled', async () => {
  await scan()
  assert.equal((await usdt.scanUsdtTransfers()).status, 'throttled')
  const [first, second] = await Promise.all([
    usdt.scanUsdtTransfers({ force: true }),
    usdt.scanUsdtTransfers({ force: true }),
  ])
  assert.deepEqual([first.status, second.status].sort(), ['busy', 'ok'])
})

test('transaction ids are read out of whatever the customer pastes', () => {
  const hash = `0x${'ab'.repeat(32)}`
  assert.equal(bsc.extractTxHash(hash), hash)
  assert.equal(bsc.extractTxHash(`https://bscscan.com/tx/${hash.toUpperCase().replace('0X', '0x')}`), hash)
  assert.equal(bsc.extractTxHash(`  ${'AB'.repeat(32)}  `), hash)
  assert.equal(bsc.extractTxHash('0x1234'), null)
  assert.equal(bsc.formatE4(250_037), '25.0037')
})

test('a claimed transfer is released back to the queue when another transfer pays that invoice', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 9100)
  const rounded = send('91.00')
  mine(5)
  await usdt.claimTransfer(invoice.reference, user.id, rounded)
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'review')

  const coded = send(e4ToAmount(invoice.pay_amount_e4!))
  mine(5)
  await scan()
  const codedRow = usdt.unmatchedTransfers().find((row) => row.tx_hash === coded)!
  await usdt.adminConfirmInvoice(newUser().id, invoice.reference, codedRow.id)
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
  const released = usdt.unmatchedTransfers().find((row) => row.tx_hash === rounded)
  assert.ok(released, 'the uncoded 91.00 is visible to a person again, not hidden behind a closed invoice')
  assert.match(released.note!, /another transfer then paid/)
})

test('an invoice made after the money moved can never catch it, however soon after', async () => {
  // A stranger's mistyped transfer sits unmatched; someone opens invoices
  // right afterwards hoping one draws its code. None may ever settle with it.
  const victimTx = send('52.0042', { secondsAgo: 0 })
  mine(5)
  await scan()
  const hunter = newUser()
  const opened: string[] = []
  for (const cents of [5000, 5100, 5200, 5300, 5400]) {
    opened.push(payments.createInvoice(hunter.id, 'crypto_networks', cents).reference)
  }
  await scan()
  assert.equal(credits.getBalance(hunter.id).creditCents, 0)
  for (const reference of opened) {
    await assert.rejects(usdt.claimTransfer(reference, hunter.id, victimTx), /sent before this invoice was created/)
  }
  assert.ok(usdt.unmatchedTransfers().some((row) => row.tx_hash === victimTx && row.candidates.length === 0))
})

test('one account cannot hold an unlimited number of open codes', () => {
  const user = newUser()
  for (const cents of [1000, 1100, 1200, 1300, 1400]) payments.createInvoice(user.id, 'crypto_networks', cents)
  assert.throws(() => payments.createInvoice(user.id, 'crypto_networks', 1500), /5 top-ups waiting/)
  // Reopening one of the five is still fine.
  assert.ok(payments.createInvoice(user.id, 'crypto_networks', 1200))
})

test('unpaid invoices close after a week and keep their code out of circulation a while longer', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 2200)
  database
    .db()
    .prepare(`UPDATE invoices SET created_at = datetime('now', '-9 days') WHERE reference = ?`)
    .run(invoice.reference)
  await scan()
  const closed = payments.getInvoice(invoice.reference, user.id)!
  assert.equal(closed.status, 'failed')
  assert.match(closed.note!, /Expired unpaid/)

  // A late send of the old amount is not credited to whoever drew the code next.
  for (let index = 0; index < 20; index += 1) {
    const fresh = payments.createInvoice(newUser().id, 'crypto_networks', 2200)
    assert.notEqual(payments.paymentCode(fresh.pay_amount_e4!), payments.paymentCode(invoice.pay_amount_e4!))
  }
})

test('zero-value and dust transfers are never recorded, so they cannot bury real payments', async () => {
  for (let index = 0; index < 5; index += 1) send('0')
  send('0.5')
  const real = send('42.00')
  mine(5)
  await scan()
  const queue = usdt.unmatchedTransfers()
  assert.ok(queue.some((row) => row.tx_hash === real))
  assert.ok(queue.every((row) => row.amount_e4 >= usdt.DUST_FLOOR_E4))
})

test('when a coded transfer pays an invoice, any other invoice pointing at it goes back to unpaid', async () => {
  // Invoice X points at T by paste; T then turns out to carry Y's code.
  const payerY = newUser()
  const y = payments.createInvoice(payerY.id, 'crypto_networks', 6100)
  const other = newUser()
  const x = payments.createInvoice(other.id, 'crypto_networks', 6100)
  const t = send(e4ToAmount(y.pay_amount_e4!))
  mine(1) // not yet confirmed: the scan has not settled it
  database
    .db()
    .prepare(`UPDATE invoices SET status = 'review', payment_reference = ? WHERE reference = ?`)
    .run(t, x.reference)

  mine(5)
  await scan()
  assert.equal(payments.getInvoice(y.reference, payerY.id)!.status, 'success')
  const after = payments.getInvoice(x.reference, other.id)!
  assert.equal(after.status, 'pending')
  assert.equal(after.payment_reference, null)
  await assert.rejects(usdt.adminConfirmInvoice(newUser().id, x.reference), /points at no payment/)
  assert.equal(credits.getBalance(other.id).creditCents, 0)
})

test('a hash typed in by a customer is only ever confirmed through its chain record', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 3300)
  const t = send('33.00')
  mine(5)
  // As an older build would have stored it: pasted, never verified.
  payments.submitPaymentReference(invoice.reference, user.id, t, 'legacy paste')
  const confirmed = await usdt.adminConfirmInvoice(newUser().id, invoice.reference)
  assert.equal(confirmed.status, 'success')

  // The same hash pasted on a second invoice cannot be confirmed again.
  const second = payments.createInvoice(user.id, 'crypto_networks', 3400)
  payments.submitPaymentReference(second.reference, user.id, t, 'again')
  await assert.rejects(usdt.adminConfirmInvoice(newUser().id, second.reference), /already paid invoice/)
  assert.equal(credits.getBalance(user.id).creditCents, 3300)
})

test('claiming one transfer from many invoices does not get round the open-invoice cap', async () => {
  const user = newUser()
  const t = send('1.00')
  mine(5)
  const opened = [1000, 1100, 1200, 1300, 1400].map((cents) => payments.createInvoice(user.id, 'crypto_networks', cents))
  for (const invoice of opened) await usdt.claimTransfer(invoice.reference, user.id, t)
  assert.ok(opened.every((invoice) => payments.getInvoice(invoice.reference, user.id)!.status === 'review'))
  assert.throws(() => payments.createInvoice(user.id, 'crypto_networks', 1500), /5 top-ups waiting/)
})

test('an invoice in review no longer catches transfers by its code; a person places them', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 2700)
  const rounded = send('27.00')
  mine(5)
  assert.equal((await usdt.claimTransfer(invoice.reference, user.id, rounded)).outcome, 'review')
  const coded = send(e4ToAmount(invoice.pay_amount_e4!))
  mine(5)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'review')
  const row = usdt.unmatchedTransfers().find((entry) => entry.tx_hash === coded)!
  assert.ok(row.candidates.some((candidate) => candidate.reference === invoice.reference))
})

test('pointing an invoice at a second transfer puts the first back where a person sees it', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 2900)
  const first = send('29.00')
  const second = send('29.01')
  mine(5)
  await usdt.claimTransfer(invoice.reference, user.id, first)
  await usdt.claimTransfer(invoice.reference, user.id, second)
  const released = usdt.unmatchedTransfers().find((row) => row.tx_hash === first)
  assert.ok(released, 'the first claim is visible again')
  assert.match(released.note!, /pointed at another transfer/)

  const row = usdt.invoicesNeedingReview().find((entry) => entry.reference === invoice.reference)!
  usdt.adminDismissTransfer(row.transfer_id!, 'not this customer')
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')
  assert.ok(usdt.unmatchedTransfers().some((entry) => entry.tx_hash === first))
})

test('two transfers in one transaction are settled and dismissed one at a time', async () => {
  const a = newUser()
  const b = newUser()
  const invoiceA = payments.createInvoice(a.id, 'crypto_networks', 2000)
  const invoiceB = payments.createInvoice(b.id, 'crypto_networks', 1000)
  const tx = sendMany(['20.00', '10.00'])
  mine(5)
  await usdt.claimTransfer(invoiceA.reference, a.id, tx) // takes the larger, unclaimed one
  await usdt.claimTransfer(invoiceB.reference, b.id, tx) // takes the other
  const rowA = usdt.invoicesNeedingReview().find((entry) => entry.reference === invoiceA.reference)!
  const rowB = usdt.invoicesNeedingReview().find((entry) => entry.reference === invoiceB.reference)!
  assert.notEqual(rowA.transfer_id, rowB.transfer_id)

  await usdt.adminConfirmInvoice(newUser().id, invoiceA.reference, rowA.transfer_id!)
  assert.equal(payments.getInvoice(invoiceA.reference, a.id)!.credited_cents, 2000)
  assert.equal(payments.getInvoice(invoiceB.reference, b.id)!.status, 'review', 'B claimed the other transfer and keeps it')
  assert.ok(usdt.invoicesNeedingReview().some((entry) => entry.reference === invoiceB.reference))

  await usdt.adminConfirmInvoice(newUser().id, invoiceB.reference, rowB.transfer_id!)
  assert.equal(payments.getInvoice(invoiceB.reference, b.id)!.credited_cents, 1000)
})

test('a payment sent in an invoice\'s last minutes still lands, even if scanned after the deadline', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 2300)
  database
    .db()
    .prepare(`UPDATE invoices SET created_at = datetime('now', '-7 days', '+60 seconds') WHERE reference = ?`)
    .run(invoice.reference)
  send(e4ToAmount(invoice.pay_amount_e4!))
  mine(5)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
})

test('an administrator can reject evidence that is not a payment, and the invoice closes with the reason', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 2400)
  payments.submitPaymentReference(invoice.reference, user.id, `${'f'.repeat(64)}`, 'a TRON TxID')
  await assert.rejects(usdt.adminConfirmInvoice(newUser().id, invoice.reference), /cannot find this transaction/)
  usdt.adminRejectInvoice(invoice.reference, 'sent on TRON, not to this wallet')
  const after = payments.getInvoice(invoice.reference, user.id)!
  assert.equal(after.status, 'failed')
  assert.match(after.note!, /TRON/)
  assert.ok(!usdt.invoicesNeedingReview().some((entry) => entry.reference === invoice.reference))
})

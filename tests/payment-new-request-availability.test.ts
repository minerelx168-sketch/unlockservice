import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { before } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-payment-new-request-'))
process.env.IUNLOCKMOBILE_DB = join(workDir, 'payments.db')
process.env.IUNLOCKMOBILE_TOPUP_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_NEW_REQUEST_BEP20_ONLY = '1'
process.env.IUNLOCKMOBILE_TRON_RECEIVING_ADDRESS = 'TBXSw8fM4jpQkGc6zZjsVABFpVN7UvXPdV'
process.env.IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS = '0x1111111111111111111111111111111111111111'
process.env.IUNLOCKMOBILE_TOPUP_TRC20_USDT_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_BEP20_USDC_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_ERC20_USDT_ENABLED = '0'
process.env.IUNLOCKMOBILE_TOPUP_ERC20_USDC_ENABLED = '0'
process.env.IUNLOCKMOBILE_TRONGRID_API_KEY = 'synthetic-trongrid-key'
process.env.IUNLOCKMOBILE_BSC_CONFIRMATIONS = '15'
process.env.IUNLOCKMOBILE_TRON_CONFIRMATIONS = '15'

let database: typeof import('../lib/db')
let payments: typeof import('../lib/payments')
let paymentConfig: typeof import('../lib/payment-config')

before(async () => {
  database = await import('../lib/db')
  payments = await import('../lib/payments')
  paymentConfig = await import('../lib/payment-config')
  database.db()
})

test('new invoice availability is BEP20-only while historical TRON routes stay enabled', () => {
  const connection = database.db()
  const invoiceCount = () => Number((connection.prepare('SELECT COUNT(*) AS count FROM invoices').get() as { count: number }).count)
  const userId = Number(
    connection
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run('new-request-test', 'new-request-test@example.test', 'synthetic').lastInsertRowid,
  )
  const before = invoiceCount()

  assert.throws(() => payments.createInvoice(userId, 'usdt-trc20', 1_000), payments.PaymentError)
  assert.equal(invoiceCount(), before)

  const bscInvoice = payments.createInvoice(userId, 'bsc-usdt-peg', 1_000)
  assert.equal(bscInvoice.payment_route_id, 'bsc-usdt-peg')
  assert.equal(bscInvoice.payment_chain_kind, 'evm')
  assert.equal(bscInvoice.payment_chain_id, 56)

  connection
    .prepare(
      `INSERT INTO invoices (
        reference, user_id, gateway, credit_amount_cents, fee_cents, total_due_cents,
        status, payment_route_id, payment_network_id, payment_chain_kind, payment_chain_id,
        payment_asset_code, payment_token_contract, payment_token_decimals,
        payment_destination_address, payment_confirmations_required, payment_provider_mode
      ) VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      'historical-tron-invoice',
      userId,
      'usdt-trc20',
      1_000,
      1_000,
      'usdt-trc20',
      'tron-mainnet',
      'tron',
      0,
      'USDT',
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      6,
      'TBXSw8fM4jpQkGc6zZjsVABFpVN7UvXPdV',
      15,
      'trongrid',
    )
  const historical = payments.getInvoice('historical-tron-invoice', userId)
  assert.ok(historical)
  assert.equal(payments.invoiceGateway(historical)?.chainKind, 'tron')
  assert.equal(payments.invoiceGateway(historical)?.networkId, 'tron-mainnet')
  assert.equal(paymentConfig.paymentRouteConfiguration('usdt-trc20')?.enabled, true)
  assert.equal(paymentConfig.enabledPaymentRoutes().some((route) => route.id === 'usdt-trc20'), true)
  assert.deepEqual(
    payments.GATEWAYS.map((gateway) => gateway.id).sort(),
    ['bsc-usdc-peg', 'bsc-usdt-peg'],
  )
})

import { db } from '../../lib/db'
import { OrderError, submitOrder } from '../../lib/orders'

// Real independent Node processes share the test database. Only transport is
// mocked; transaction locking, ledger writes and uniqueness use real SQLite.
globalThis.fetch = async () => {
  db().prepare('INSERT INTO dispatch_probe (request_key) VALUES (?)').run(process.argv[3])
  return new Response(JSON.stringify({ SUCCESS: [{ REFERENCEID: `ref-${process.argv[3]}` }] }))
}

async function main() {
  try {
    const order = await submitOrder(Number(process.argv[2]), {
      kind: 'carrier_unlock', brandId: 1, carrierId: 103,
      imei: '490154203237518', email: 'atomic@example.test', idempotencyKey: process.argv[3],
    })
    process.stdout.write(JSON.stringify({ id: order.orderId, status: order.status }))
  } catch (error) {
    if (!(error instanceof OrderError)) throw error
    process.stdout.write(JSON.stringify({ code: error.code }))
  } finally {
    db().close()
  }
}
main().catch((error: unknown) => {
  process.stderr.write(error instanceof Error ? error.stack ?? error.message : 'Worker failed')
  process.exitCode = 1
})

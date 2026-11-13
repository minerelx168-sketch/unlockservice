import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

const directory = mkdtempSync(join(tmpdir(), 'product-card-'))
process.env.IUNLOCKMOBILE_DB = join(directory, 'cards.db')
process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.invalid/api'
process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'local-test-only'
process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ 'product:apple_carrier_lite': { id: '444', mode: 'sync' } })

let connection: ReturnType<typeof import('../lib/db').db>
let GET: typeof import('../app/api/product-card/[itemId]/route').GET
let liveFeedRows: typeof import('../lib/acp-feed-live').liveFeedRows
before(async () => {
  connection = (await import('../lib/db')).db()
  ;({ GET } = await import('../app/api/product-card/[itemId]/route'))
  ;({ liveFeedRows } = await import('../lib/acp-feed-live'))
})
after(() => { connection.close(); rmSync(directory, { recursive: true, force: true }) })

const call = (itemId: string) => GET(new Request(`https://iunlockmobile.com/api/product-card/${itemId}`), { params: Promise.resolve({ itemId }) })

test('a live feed item serves a real 1200x1200 PNG', async () => {
  const response = await call('IUM-SKU-444.png')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/png')
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(bytes.readUInt32BE(16), 1200)
  assert.equal(bytes.readUInt32BE(20), 1200)
})

test('live feed only lists what checkout accepts, and unknown or blocked items 404', async () => {
  const rows = liveFeedRows()
  assert.deepEqual(rows.map((row) => row.item_id), ['IUM-SKU-444'])
  assert.equal(rows[0].price, '1.70 USD')
  for (const id of ['IUM-SKU-718.png', 'IUM-SKU-1000.png', 'IUM-SKU-445.png', 'evil.svg']) assert.equal((await call(id)).status, 404, id)
})

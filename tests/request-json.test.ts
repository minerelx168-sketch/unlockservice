import assert from 'node:assert/strict'
import test from 'node:test'
import { readCommandJson } from '../lib/request-json'

test('authenticated commands require an object and cap actual request bytes', async () => {
  const request = (body: string) => new Request('https://example.test/api/orders', { method: 'POST', body })
  assert.deepEqual(await readCommandJson(request('{"imei":"490154203237518"}')), { imei: '490154203237518' })
  for (const body of ['null', '[]', '5', 'not json']) await assert.rejects(readCommandJson(request(body)))
  await assert.rejects(readCommandJson(request(JSON.stringify({ value: 'a'.repeat(17 * 1024) }))), /too large/)
})

import { scanUsdtTransfers, usdtGateway } from './usdt'

/**
 * The background half of payment detection: one scan every interval for as
 * long as the server runs. The scan holds a lease, so this, a customer's
 * open invoice and `npm run usdt:scan` never read the same blocks at once.
 */

const STARTED = Symbol.for('iunlockmobile.usdtWatcher')

export function startUsdtWatcher() {
  const registry = globalThis as typeof globalThis & { [STARTED]?: boolean }
  if (registry[STARTED]) return
  if (process.env.IUNLOCKMOBILE_USDT_WATCH === '0' || !usdtGateway()) return
  registry[STARTED] = true

  const seconds = Number(process.env.IUNLOCKMOBILE_USDT_WATCH_INTERVAL_SECONDS ?? 20)
  const interval = Math.min(Math.max(Number.isFinite(seconds) ? seconds : 20, 10), 600) * 1000

  let lastError: string | null = null
  const tick = async () => {
    const result = await scanUsdtTransfers({ force: true }).catch((error: unknown) => ({
      status: 'error' as const,
      error: error instanceof Error ? error.message : String(error),
    }))
    if (result.status === 'error') {
      // One line per distinct failure, not one every twenty seconds.
      if (result.error !== lastError) console.error(`[usdt] watcher: ${result.error}`)
      lastError = result.error
    } else if (result.status === 'ok') {
      if (lastError) console.info('[usdt] watcher recovered')
      lastError = null
      if (result.settled > 0) console.info(`[usdt] settled ${result.settled} invoice(s) from blocks ${result.fromBlock}–${result.toBlock}`)
    }
  }

  setTimeout(tick, 5_000).unref()
  setInterval(tick, interval).unref()
  console.info(`[usdt] watcher started, every ${interval / 1000}s`)
}

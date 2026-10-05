/**
 * Starts the USDT watcher inside the server process, so detecting a payment
 * needs no extra unit, timer or worker on the box. Node runtime only — the
 * watcher reads SQLite — and never during a build. The import stays inside
 * the runtime check so the edge bundle never sees better-sqlite3.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startUsdtWatcher } = await import('./lib/usdt-watcher')
    startUsdtWatcher()
  }
}

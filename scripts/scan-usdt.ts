import { scanUsdtTransfers } from '../lib/usdt'

/** One scan from the shell — for a timer, or to look at what the watcher sees. */
async function main() {
  const result = await scanUsdtTransfers({ force: true })
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (result.status === 'error') process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'USDT scan failed.'}\n`)
  process.exitCode = 1
})

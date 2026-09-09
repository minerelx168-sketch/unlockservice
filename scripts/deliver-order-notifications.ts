import { deliverOrderNotifications } from '../lib/order-notifications'

async function main() {
  const summary = await deliverOrderNotifications(Number(process.argv[2] ?? 20))
  // Only aggregate counts reach worker logs; no customer or provider payloads.
  process.stdout.write(`${JSON.stringify(summary)}\n`)
  if (summary.failed > 0) process.exitCode = 1
}

main().catch(() => {
  process.stderr.write('Order notification worker failed. Check database and delivery configuration.\n')
  process.exitCode = 1
})

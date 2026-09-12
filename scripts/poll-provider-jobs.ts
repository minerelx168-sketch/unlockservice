import { deliverOrderNotifications } from '../lib/order-notifications'
import { pollProviderJobs } from '../lib/provider-jobs'

async function main() {
  const limit = Number(process.argv[2] ?? 20)
  const boundedLimit = Number.isFinite(limit) ? limit : 20
  const provider = await pollProviderJobs(boundedLimit)
  const notifications = await deliverOrderNotifications(boundedLimit)
  process.stdout.write(`${JSON.stringify({ provider, notifications })}\n`)
  if (provider.errors > 0 || notifications.failed > 0 || notifications.leaseLost > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Provider polling or notification delivery failed.'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

import { pollProviderJobs } from '../lib/provider-jobs'

async function main() {
  const limit = Number(process.argv[2] ?? 20)
  const summary = await pollProviderJobs(Number.isFinite(limit) ? limit : 20)
  process.stdout.write(`${JSON.stringify(summary)}\n`)
  if (summary.errors > 0) process.exitCode = 1
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Provider polling failed.'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

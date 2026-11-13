#!/usr/bin/env node
// Fetch key public URLs with each AI / search crawler User-Agent and flag
// anything a crawler would not receive as normal HTML/text: HTTP 403/429,
// a Cloudflare challenge (cf-mitigated header or challenge markup), a
// redirect to /login, or a noindex X-Robots-Tag.
//
//   npm run geo:verify-bots                     # production
//   SITE_URL=https://staging.example node scripts/verify-ai-crawlers.mjs
//   node scripts/verify-ai-crawlers.mjs --json  # machine-readable output
//
// Exit code 1 when any check fails, so it can gate a deploy or cron alert.
// Note: Cloudflare verifies real crawlers by IP; a spoofed UA from a normal
// network can be challenged even when real bots pass. A 403 here is still a
// strong signal to review AI Crawl Control and WAF rules.
const origin = new URL(process.env.SITE_URL || 'https://iunlockmobile.com').origin
const json = process.argv.includes('--json')
const AGENTS = {
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Claude-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)',
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bingbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
}
const PATHS = [
  '/', '/es/checar-imei-iphone', '/fr-ca/deverrouiller-iphone-canada',
  '/services/imei-check/apple-carrier-lock-status', '/reports/2026-used-iphone-carrier-lock-report',
  '/robots.txt', '/llms.txt',
]
const CHALLENGE = /cf-chl-|challenge-platform|Just a moment\.\.\.|Attention Required! \| Cloudflare|cf_chl_opt/i

async function probe(bot, ua, path) {
  const started = Date.now()
  try {
    const r = await fetch(origin + path, { headers: { 'User-Agent': ua, Accept: 'text/html,text/plain;q=0.9,*/*;q=0.8' }, redirect: 'manual', signal: AbortSignal.timeout(20000) })
    const body = r.status < 300 ? await r.text() : ''
    const problems = []
    if ([403, 429, 503].includes(r.status)) problems.push(`HTTP ${r.status}`)
    else if (r.status >= 400) problems.push(`HTTP ${r.status}`)
    const location = r.headers.get('location') ?? ''
    if (r.status >= 300 && r.status < 400) problems.push(/\/login|\/auth\//.test(location) ? `redirected to login (${location})` : `redirect ${r.status} → ${location}`)
    if (r.headers.get('cf-mitigated')) problems.push(`cf-mitigated: ${r.headers.get('cf-mitigated')}`)
    if (CHALLENGE.test(body)) problems.push('Cloudflare challenge page')
    if (/noindex/i.test(r.headers.get('x-robots-tag') ?? '')) problems.push('X-Robots-Tag noindex')
    return { bot, path, status: r.status, ms: Date.now() - started, ok: problems.length === 0, problems }
  } catch (error) {
    return { bot, path, status: 0, ms: Date.now() - started, ok: false, problems: [`network error: ${error?.cause?.code ?? error?.message ?? error}`] }
  }
}

const results = []
for (const [bot, ua] of Object.entries(AGENTS)) {
  results.push(...await Promise.all(PATHS.map(path => probe(bot, ua, path))))
}
const failed = results.filter(r => !r.ok)
if (json) console.log(JSON.stringify({ origin, checked: results.length, failed: failed.length, results }, null, 2))
else {
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.bot.padEnd(17)} ${String(r.status).padEnd(4)} ${r.path}${r.ok ? '' : '  ← ' + r.problems.join('; ')}`)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed for ${origin}`)
}
if (failed.length) {
  const blocked = failed.some(r => r.problems.some(p => /HTTP (403|429|503)|cf-mitigated|challenge/i.test(p)))
  console.error(`\n⚠️  ALERT: ${failed.length} crawler check(s) failed.`)
  if (blocked) console.error(`
Cloudflare appears to be blocking or challenging crawlers. Fix in the Cloudflare dashboard:
  1. Security → AI Crawl Control (Bots):
       • Search Bots  = Allow   (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Googlebot, bingbot, Applebot)
       • Agent Bots   = Allow   (ChatGPT-User, Perplexity-User, Claude-User)
       • Training     = Allow, or "Disallow AI training" via robots — NEVER "Block"
  2. Security → WAF → Custom rules → Create rule "Skip challenge for verified AI search bots":
       Expression: (cf.verified_bot_category in {"Search Engine Crawler" "AI Search" "AI Assistant"})
       Action: Skip → All Super Bot Fight Mode rules + Managed Challenge / Browser Integrity Check
  3. Security → Bots → turn off "Block AI bots" if it is enabled.
  4. Caching → Purge Everything, then re-run: npm run geo:verify-bots`)
  process.exit(1)
}

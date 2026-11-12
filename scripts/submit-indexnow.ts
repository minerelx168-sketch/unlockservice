// Run after deploying: npx tsx scripts/submit-indexnow.ts [--submit] https://iunlockmobile.com/articles/...
const origin = 'https://iunlockmobile.com'
const key = '3034800b0c676bdc55c54c2b913f785d'
async function main() {
  const args = process.argv.slice(2)
  const urls = [...new Set(args.filter(a => a !== '--submit'))]
  if (!urls.length || urls.length > 10000) throw Error('Supply 1–10,000 changed production URLs')
  for (const raw of urls) {
    const u = new URL(raw)
    if (u.origin !== origin || u.href !== raw || u.search || u.hash || u.username || u.password ||
        !/^\/(?:articles|services)(?:\/[a-z0-9-]+)*$/.test(u.pathname)) throw Error('Expected canonical public article/service URL')
  }
  async function read(path: string) {
    const r = await fetch(origin + path, { redirect: 'error', signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw Error('Failed to fetch ' + path + ': ' + r.status)
    return r.text()
  }
  const sitemap = new Set([...((await read('/sitemap.xml')).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g))].map(m => m[1]))
  if (urls.some(u => !sitemap.has(u))) throw Error('URL missing from production sitemap')
  if (!args.includes('--submit')) { console.log('Dry run; no URLs submitted:', urls); return }
  if ((await read('/' + key + '.txt')).trim() !== key) throw Error('Production key mismatch')
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({host: new URL(origin).host, key, urlList: urls}),
  })
  if (![200,202].includes(r.status)) throw Error('IndexNow returned ' + r.status)
  console.log('IndexNow response:', r.status, 'URLs:', urls.length)
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })

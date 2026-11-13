// Submit every published URL to IndexNow (Bing, Yandex, Seznam, Naver…).
//   npm run indexnow:ping            # submit
//   npm run indexnow:ping -- --dry-run  # list URLs only
// Only the fixed production origin and URLs from the published sitemaps (plus
// the discovery files) can be submitted, in batches of at most 10,000.
const origin=new URL(process.env.SITE_URL || 'https://iunlockmobile.com').origin
if(origin!=='https://iunlockmobile.com')throw Error('SITE_URL must match the production site')
const dry=process.argv.includes('--dry-run')
const key=process.env.INDEXNOW_KEY?.trim()??''
const BATCH=10000
if(!dry&&!/^[A-Za-z0-9-]{8,128}$/.test(key)){console.warn('Skipped IndexNow: set INDEXNOW_KEY to the production ownership key (8–128 letters, digits or hyphens).');process.exit(0)}
const get=async(path)=>{const r=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Production resource unavailable: '+path+' '+r.status);return r.text()}
function entries(xml){if(!/<urlset\b/.test(xml))throw Error('Invalid sitemap');return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap(([,item])=>{
 const loc=item.match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1];if(!loc)return []
 const u=new URL(loc);return u.origin===origin&&!u.search&&!u.hash?[{url:u.href,path:u.pathname}]:[]
})}
// Home, six language hubs, services, tools, reports, articles (all locales) and programmatic model pages.
const PUBLIC=/^\/(?:(?:es|fr-ca|pt|de|ar)(?:\/[a-z0-9-]+)*|services(?:\/[a-z0-9-]+)*|tools(?:\/[a-z0-9-]+)?|reports\/[a-z0-9-]+|articles(?:\/[a-z0-9-]+)?|check(?:\/[a-z0-9-]+)*)?\/?$/
const maps=await Promise.all(['/sitemap.xml','/sitemap-models.xml'].map(p=>get(p).catch(e=>{console.warn(String(e.message));return '<urlset></urlset>'})))
const urls=[...new Set(maps.flatMap(entries).filter(r=>PUBLIC.test(r.path)&&!/^\/services\/unlock\/(?:catalog|more)$/.test(r.path)).map(r=>r.url))]
for(const p of ['/','/es','/fr-ca','/pt','/de','/ar','/llms.txt','/llms-full.txt','/tools','/reports/2026-used-iphone-carrier-lock-report','/services/imei-check/apple-carrier-lock-status','/services/unlock/us','/services/unlock/canada','/es/checar-imei-iphone','/fr-ca/deverrouiller-iphone-canada'])if(!urls.includes(origin+p))urls.push(origin+p)
if(!urls.length)throw Error('No eligible URLs')
if(dry){console.log(urls.join('\n'));console.log(`\n${urls.length} URLs (dry run, nothing submitted)`);process.exit(0)}
// Prefer the default key location (/<key>.txt); fall back to /indexnow-key.txt.
let keyLocation=origin+'/'+key+'.txt'
if((await get('/'+key+'.txt').catch(()=>'')).trim()!==key){
 if((await get('/indexnow-key.txt')).trim()!==key)throw Error('Public key verification failed: neither /'+key+'.txt nor /indexnow-key.txt returns INDEXNOW_KEY')
 keyLocation=origin+'/indexnow-key.txt'
}
let sent=0
for(let i=0;i<urls.length;i+=BATCH){
 const urlList=urls.slice(i,i+BATCH)
 const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({host:new URL(origin).hostname,key,keyLocation,urlList})})
 console.log(`IndexNow batch ${i/BATCH+1}: HTTP ${r.status} for ${urlList.length} URLs`)
 if(![200,202].includes(r.status))throw Error('IndexNow HTTP '+r.status+' '+(await r.text().catch(()=>'')).slice(0,200))
 sent+=urlList.length
}
console.log(`IndexNow accepted ${sent}/${urls.length} URLs (key at ${keyLocation})`)

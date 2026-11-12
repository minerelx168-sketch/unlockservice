// Only the fixed production origin and published sitemap paths can be submitted.
const origin='https://iunlockmobile.com', dry=process.argv.includes('--dry-run')
const key=process.env.INDEXNOW_KEY??''
if(!dry&&!/^[A-Za-z0-9-]{8,128}$/.test(key))throw Error('Configure INDEXNOW_KEY first')
const get=async(path)=>{const r=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Production resource unavailable: '+r.status);return r.text()}
function entries(xml){if(!/<urlset\b/.test(xml))throw Error('Invalid sitemap');return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap(([,item])=>{
 const loc=item.match(/<loc>([^<]+)<\/loc>/)?.[1];if(!loc)return []
 const u=new URL(loc);return u.origin===origin&&!u.search&&!u.hash?[{url:u.href,path:u.pathname,date:item.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]??''}]:[]
})}
const [main,models]=await Promise.all(['/sitemap.xml','/sitemap-models.xml'].map(get))
const rows=entries(main), guides=rows.filter(r=>/^\/(?:(?:es|fr-ca|pt|de|ar)\/)?articles\/[a-z0-9-]+$/.test(r.path)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12)
const urls=[...new Set([...rows.filter(r=>/^\/(?:es|fr-ca|pt|de|ar)?\/?$/.test(r.path)||/^\/(?:tools(?:\/[a-z0-9-]+)?|reports\/[a-z0-9-]+)$/.test(r.path)),...guides,...entries(models).filter(r=>/^\/(?:check|services\/unlock)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/.test(r.path))].map(r=>r.url))]
if(!urls.length)throw Error('No eligible URLs')
if(dry)console.log(urls.join('\n'))
else{
 if((await get('/indexnow-key.txt')).trim()!==key)throw Error('Public key verification failed')
 const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify({host:new URL(origin).hostname,key,keyLocation:origin+'/indexnow-key.txt',urlList:urls})})
 if(![200,202].includes(r.status))throw Error('IndexNow HTTP '+r.status)
 console.log('IndexNow HTTP',r.status,'for',urls.length,'URLs')
}

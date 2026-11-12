import assert from 'node:assert/strict'
const base = process.argv[2] ?? 'http://127.0.0.1:4182'
const phrases = ['What would you like to do','Choose your unlock service','Search by device, network or service name','Working Days','View example output','Carriers We Unlock','Is your phone eligible','Three steps. Nothing to install','Straight answers before you pay','Top Brands We Support','Everything on offer','We use cookies to improve your experience']
for(const [prefix,lang] of Object.entries({es:'es-MX','fr-ca':'fr-CA',pt:'pt-BR',de:'de-AT',ar:'ar'})){
 const response=await fetch(base+'/'+prefix,{headers:{Cookie:'NEXT_LOCALE=en'}})
 const html=await response.text()
 const matches=phrases.filter(p=>html.toLowerCase().includes(p.toLowerCase()))
 const faq=(html.match(/<details class="faq-item"/g)??[]).length
 console.log(prefix,response.status,faq+' FAQs',matches.length+' English phrases',matches)
 assert.equal(response.status,200);assert.ok(html.includes('lang="'+lang+'"'));assert.ok(html.includes('dir="'+(prefix==='ar'?'rtl':'ltr')+'"'));assert.equal(faq,9);assert.deepEqual(matches,[])
}

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { serviceIdentifier, identifierField } from '../lib/service-identifier'
import { guestCardQuote } from '../lib/guest-card-quote'
type Element = { type: unknown; props: Record<string, any> }
function render(domain:'unlock'|'imei_check',imei='490154203237518',validEmail=true) {
  const navigate=()=>{},events:string[]=[],record={exports:{} as {HeroPriceCheck:(props:unknown)=>Element}}
  const jsx=(type:unknown,props:Record<string,unknown>)=>({type,props})
  const imports:Record<string,unknown>={
    'react/jsx-runtime':{jsx,jsxs:jsx},
    'react':{useState:(value:unknown)=>[value,()=>{}],useRef:(value:unknown)=>({current:value}),useEffect:()=>{},useActionState:()=>[{},navigate,false]},
    '@/lib/device-intent-actions':{continueDeviceServiceAction:navigate},
    '@/lib/service-identifier':{serviceIdentifier,identifierField},
    '@/lib/guest-card-quote':{guestCardQuote},
    '@/lib/money':{formatUsd:(cents:number)=>`$${(cents/100).toFixed(2)}`},
    '@/lib/funnel-analytics':{trackFunnelEvent:(name:string)=>events.push(name)},
    'next/link':{default:'a'},'@/components/service-description':{ServiceDescription:'description'},
    './icons':{Icon:'icon'},'./service-picker':{ServicePicker:'picker'},
  }
  const code=ts.transpileModule(readFileSync('components/hero-price-check.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  vm.runInNewContext(code,{module:record,exports:record.exports,require:(name:string)=>{if(!(name in imports)) throw new Error(`Unexpected import ${name}`);return imports[name]}})
  const product={code:'SERVICE',inputType:'imei',domain,name:'Service',category:'Reports',priceCents:75,etaLabel:'1–24 hours',available:true}
  const tree=record.exports.HeroPriceCheck({unlock:[product],check:[product],ordering:true,fixedDomain:domain,initialProductCode:'SERVICE',initialImei:imei,initialEmail:'buyer@example.test'})
  function visit(node:any) {
    if(Array.isArray(node)){node.forEach(visit);return}
    if(!node?.props)return
    if(node.type==='input' && node.props.name==='email') node.props.ref.current={validity:{valid:validEmail},focus:()=>{}}
    if(node.type==='input' && node.props.name==='imei') node.props.ref.current={focus:()=>{}}
    visit(node.props.children)
  }
  visit(tree)
  let prevented=false
  tree.props.onSubmit({preventDefault:()=>{prevented=true}})
  return {tree,navigate,events,prevented}
}
test('public unlock and phone-check forms go directly to the one order summary',()=>{
  for(const domain of ['unlock','imei_check'] as const){
    const result=render(domain)
    assert.equal(result.prevented,false)
    assert.equal(result.tree.props.action,result.navigate)
    assert.ok(result.events.includes('order_summary_requested'))
    assert.equal(result.events.includes('order_preview_viewed'),false)
  }
})
test('invalid public-form details still stop navigation before any payment request',()=>{
  assert.equal(render('unlock','123').prevented,true)
  assert.equal(render('imei_check','490154203237518',false).prevented,true)
})

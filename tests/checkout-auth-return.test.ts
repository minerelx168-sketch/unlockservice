import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { safeContinuation, withContinuation } from '../lib/continuation'

const checkout='/checkout?product=APPLE_CASE_REPAIR_HISTORY&method=card'
const originalDraft=JSON.stringify({imei:'490154203237518',email:'buyer@example.test',productCode:'APPLE_CASE_REPAIR_HISTORY'})
class TestAuthError extends Error {}
type State={error?:string;message?:string}
type Action=(state:State,data:FormData)=>Promise<State>

// Run the real auth actions with all external effects replaced at their boundary.
function actions(verificationRequired:boolean) {
  const events:string[]=[],draft={value:originalDraft}
  const user={id:42,email:'buyer@example.test'}, session={id:'test-session',userId:user.id}
  const record={exports:{} as {registerAction:Action;verifyEmailAction:Action;loginAction:Action}}
  const forbidden=()=>{throw new Error('Auth must not create an order or payment')}
  const mocks:Record<string,unknown>={
    'next/navigation':{redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`)}},
    'next/cache':{revalidatePath:()=>events.push('revalidate')},
    './auth':{AuthError:TestAuthError,register:()=>{events.push('registered');return user},authenticate:()=>{events.push('authenticated');return user},
      createSession:()=>{events.push('session-created');return session},setSessionCookie:async()=>events.push('session-cookie')},
    './account-security':{emailVerificationRequired:()=>verificationRequired,startEmailVerification:async()=>events.push('verification-sent'),
      verifyEmail:()=>{events.push('email-verified');return user}},
    './continuation':{safeContinuation,withContinuation},
    './provider':{landingRoute:()=>'/user/dashboard'},
    './device-intent':{clearDeviceIntent:()=>{draft.value='';events.push('draft-cleared')},writeDeviceIntent:()=>events.push('draft-overwritten')},
    './payments':{createInvoice:forbidden,approveInvoice:forbidden,submitPaymentReference:forbidden},
  }
  const code=ts.transpileModule(readFileSync('lib/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(code,{module:record,exports:record.exports,require:(name:string)=>mocks[name]??{},URL})
  return {...record.exports,events,draft}
}
function form(next=checkout) {
  const data=new FormData()
  for (const [name,value] of Object.entries({username:'buyer',email:'buyer@example.test',identity:'buyer@example.test',password:'test-only-password',code:'123456',next})) data.set(name,value)
  return data
}

test('signup creates a session then immediately redirects to the exact saved checkout without clearing its draft',async()=>{
  const a=actions(false)
  await assert.rejects(a.registerAction({},form()),{message:`REDIRECT:${checkout}`})
  assert.deepEqual(a.events,['registered','session-created','session-cookie','revalidate'])
  assert.equal(a.draft.value,originalDraft)
})

test('required email verification retains checkout, grants no early session, and returns automatically on successful verification',async()=>{
  const a=actions(true)
  const verify=withContinuation('/verify-email?email=buyer%40example.test',checkout)
  await assert.rejects(a.registerAction({},form()),{message:`REDIRECT:${verify}`})
  assert.deepEqual(a.events,['registered','verification-sent','revalidate'])
  assert.equal(a.draft.value,originalDraft)
  a.events.length=0
  await assert.rejects(a.verifyEmailAction({},form()),{message:`REDIRECT:${checkout}`})
  assert.deepEqual(a.events,['email-verified','session-created','session-cookie','revalidate'])
  assert.equal(a.draft.value,originalDraft)
})

test('existing customer sign-in returns directly to checkout and rejects external continuation',async()=>{
  const a=actions(true)
  await assert.rejects(a.loginAction({},form()),{message:`REDIRECT:${checkout}`})
  assert.deepEqual(a.events,['authenticated','session-created','session-cookie','revalidate'])
  assert.equal(a.draft.value,originalDraft)
  await assert.rejects(a.loginAction({},form('//attacker.example/checkout')),{message:'REDIRECT:/user/dashboard'})
})

test('Google signup callback sets the authenticated session and returns to checkout while retaining the device draft',async()=>{
  const jar=new Map([['google-return',checkout],['google-transaction','test-transaction'],['device-draft',originalDraft]])
  const events:string[]=[]
  type Response={url:string;cookies:{set:(name:string,value:string)=>void};headers:Headers}
  const record={exports:{} as {GET:(request:Request)=>Promise<Response>}}
  const mocks:Record<string,unknown>={
    'next/headers':{cookies:async()=>({get:(name:string)=>jar.has(name)?{value:jar.get(name)}:undefined})},
    'next/server':{NextResponse:{redirect:(url:string)=>({url:String(url),headers:new Headers(),cookies:{set:(name:string,value:string)=>{jar.set(name,value)}}})}},
    '@/lib/auth':{AuthError:TestAuthError,createSession:(id:number)=>{assert.equal(id,42);events.push('session-created');return{id:'google-test-session'}},SESSION_COOKIE:'session',sessionCookieOptions:()=>({})},
    '@/lib/google-oauth':{completeGoogleOAuth:async(transaction:string,state:string,code:string)=>{
      assert.deepEqual([transaction,state,code],['test-transaction','test-state','test-code']);events.push('google-verified');return{id:42}
    },GOOGLE_OAUTH_COOKIE:'google-transaction',googleOAuthPublicUrl:(path:string)=>new URL(path,'https://iunlockmobile.com').toString()},
    '@/lib/cookie-names':{GOOGLE_RETURN_COOKIE:'google-return'},
    '@/lib/continuation':{safeContinuation,withContinuation},
    '@/lib/provider':{landingRoute:()=>'/user/dashboard'},
  }
  const code=ts.transpileModule(readFileSync('app/(auth)/auth/google/callback/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(code,{module:record,exports:record.exports,require:(name:string)=>mocks[name]??{},URL,process:{env:{NODE_ENV:'test'}}})
  const response=await record.exports.GET(new Request('https://iunlockmobile.com/auth/google/callback?state=test-state&code=test-code'))
  assert.equal(response.url,`https://iunlockmobile.com${checkout}`)
  assert.deepEqual(events,['google-verified','session-created'])
  assert.equal(jar.get('session'),'google-test-session')
  assert.equal(jar.get('device-draft'),originalDraft)
  assert.equal(jar.get('google-transaction'),'')
  assert.equal(jar.get('google-return'),'')
})

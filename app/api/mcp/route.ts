import {toolspec,schema,invoke,origin} from '@/lib/agent-discovery'
import {json,throttle} from '@/lib/agent-http'
const version='2025-03-26'
const list=()=>toolspec.map(t=>({name:t.name,description:t.description,inputSchema:schema(t),annotations:{readOnlyHint:true}}))
export function GET(r:Request){return throttle(r)??(r.headers.get('accept')?.includes('text/event-stream')?new Response(null,{status:405,headers:{Allow:'POST'}}):json({protocolVersion:version,transport:'POST JSON-RPC',tools:list()}))}
export async function POST(r:Request){
 const limited=throttle(r);if(limited)return limited
 if(r.headers.has('origin')&&r.headers.get('origin')!==origin)return json({error:'Origin not allowed'},403)
 if(!r.headers.get('content-type')?.startsWith('application/json'))return json({error:'Expected JSON'},415)
 const reader=r.body?.getReader();if(!reader)return json({error:'Missing body'},400)
 let size=0;const chunks:Uint8Array[]=[]
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return json({error:'Body too large'},413)}chunks.push(value)}
 let b;try{b=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},400)}
 const id=b?.id??null
 const err=(code:number,message:string)=>json({jsonrpc:'2.0',id,error:{code,message}})
 if(!b||b.jsonrpc!=='2.0'||typeof b.method!=='string'||(id!==null&&typeof id!=='string'&&typeof id!=='number'))return err(-32600,'Invalid request')
 if(id===null&&b.method.startsWith('notifications/'))return new Response(null,{status:202})
 if(id===null)return err(-32600,'Missing request id')
 const result=(v:unknown)=>json({jsonrpc:'2.0',id,result:v})
 if(b.method==='initialize')return result({protocolVersion:version,capabilities:{tools:{}},serverInfo:{name:'iunlockmobile',version:'1.0.0'}})
 if(b.method==='ping')return result({})
 if(b.method==='tools/list')return result({tools:list()})
 if(b.method!=='tools/call')return err(-32601,'Method not found')
 try{return result({content:[{type:'text',text:JSON.stringify(invoke(b.params?.name,b.params?.arguments??{}))}]})}catch{return err(-32602,'Invalid tool or arguments')}
}

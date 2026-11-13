import {origin,toolspec,schema} from '@/lib/agent-discovery'

const string = {type:'string'}
const boolean = {type:'boolean'}
const number = {type:'number'}
const nullable = {type:['string','null']}
const operation = {
  validate_imei: {id:'validateImei', properties:{validFormat:boolean,luhnValid:boolean,normalizedImei:nullable,tacPrefix:nullable,detectedHardware:{type:['object','null'],properties:{displayName:string}},diagnosticBoundary:string,recommendedNextStep:string,localizedHubs:{type:'object',additionalProperties:string}}},
  decode_apple_model: {id:'decodeAppleModel',properties:{modelNumber:string,known:boolean,variants:{type:'array',items:{type:'object',properties:{model:string,market:string,sim:string}}},part:string,region:string,origin:string,simGuidance:string,liveCarrierCheckUrl:string}},
  get_service_quote: {id:'getServiceQuote',properties:{offers:{type:'array',items:{type:'object',properties:{sku:string,carrier:string,available:boolean,serviceMode:{enum:['unlock_available','status_check_only']},basePriceUsd:number,cardTotalUsd:number,cryptoFeeNote:string,turnaround:string,eligibilitySummary:string,checkoutUrl:string}}}}}
}
export function GET(){
  const paths=Object.fromEntries(toolspec.map(t=>{
    const op=operation[t.name as keyof typeof operation]
    return ['/api/agent/'+t.path,{get:{operationId:op.id,'x-openai-isConsequential':false,description:t.description,
      parameters:t.fields.map(k=>({name:k,in:'query',required:t.required.includes(k),schema:schema(t).properties[k]})),
      responses:{'200':{description:'Read-only diagnostic result',content:{'application/json':{schema:{type:'object',properties:op.properties}}}},'400':{description:'Invalid input'},'429':{description:'Rate limit reached'}}}}]
  }))
  return Response.json({openapi:'3.1.0',info:{title:'iUnlockMobile public tools',version:'1.1.0'},servers:[{url:origin}],paths},{headers:{'Access-Control-Allow-Origin':'*'}})
}

// Offline hints, never a device authentication or network status check.
export function luhnSteps(imei:string):number[] {
  if(!/^\d{15}$/.test(imei)) return []
  return Array.from(imei,(n,i)=>{const v=Number(n)*(i%2?2:1);return v>9?v-9:v})
}
export function validateImeiLuhn(imei:string):boolean {
  const steps=luhnSteps(imei)
  return steps.length===15 && !/^0+$/.test(imei) && steps.reduce((a,b)=>a+b,0)%10===0
}
export function extractTac(imei:string):string|null {return validateImeiLuhn(imei)?imei.slice(0,8):null}
const regions:Record<string,string>={LL:'United States',VC:'Canada',J:'Japan',B:'UK / Ireland',ZD:'European distribution (including Germany and Austria)',E:'Mexico',BR:'Brazil',BZ:'Brazil',AE:'Middle East',AB:'Middle East',CH:'China mainland',ZP:'Hong Kong / Macao',TH:'Thailand'}
const origins:Record<string,string>={M:'Retail',F:'Refurbished',N:'Service replacement',P:'Personalized','3':'Possible demonstration unit (unverified)'}
export function decodeAppleModelNumber(input:string){
  const part=input.trim().toUpperCase()
  const m=/^([A-Z0-9])[A-Z0-9]{4}([A-Z]{1,3})\/A$/.exec(part)
  if(!m)return null
  return {part,prefix:m[1],regionCode:m[2],origin:origins[m[1]]??null,region:regions[m[2]]??null}
}

import {listStorefrontProviderProducts} from './public-provider-catalog'
export function geoOffers(domain:'unlock'|'imei_check',codes:string[]){
 return listStorefrontProviderProducts(domain).filter(p=>codes.includes(p.productCode)&&p.status==='available'&&p.priceCents>0)
 .map(p=>({code:p.productCode,name:p.name,domain:p.domain,cents:p.priceCents}))
}

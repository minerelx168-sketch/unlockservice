export const clusters = [
  ['/services/imei-check/apple-carrier-lock-status','/es/checar-imei-iphone','/fr-ca/verifier-operateur-iphone-imei'],
  ['/services/unlock/us/att','/es/desbloquear-iphone-att','/fr-ca/deverrouiller-iphone-att'],
  ['/services/unlock/canada','/es/desbloquear-iphone-canada','/fr-ca/deverrouiller-iphone-canada'],
  ['/services/imei-check/blacklist-status','/es/verificar-reporte-robo-imei','/fr-ca/verifier-liste-noire-imei-canada']
]
export function languageLinks(path:string){
  const cluster=clusters.find(c=>c.includes(path)) ?? clusters[0]
  return {'en-US':cluster[0],'en-CA':cluster[0],'es-MX':cluster[1],'es-US':cluster[1],'fr-CA':cluster[2],'x-default':cluster[0]}
}

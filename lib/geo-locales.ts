export const locales=['en','es','fr','pt','de','ar'] as const
export type GeoLocale=typeof locales[number]
export const languages=['English','Español','Français (Canada)','Português (Brasil)','Deutsch','العربية']
export const markets=['en-US','es-MX','fr-CA','pt-BR','de-AT','ar'] as const
export const paths=[
 ['/services/imei-check/apple-carrier-lock-status','/es/checar-imei-iphone','/fr-ca/verifier-operateur-iphone-imei','/pt/verificar-operadora-iphone-imei','/de/iphone-simlock-betreiber-pruefen','/ar/check-iphone-carrier-imei'],
 ['/services/unlock/us/att','/es/desbloquear-iphone-att','/fr-ca/deverrouiller-iphone-att','/pt/desbloquear-iphone-att-eua','/de/att-iphone-usa-entsperren','/ar/unlock-att-iphone-usa'],
 ['/services/unlock/canada','/es/desbloquear-iphone-canada','/fr-ca/deverrouiller-iphone-canada','/pt/desbloquear-iphone-canada','/de/iphone-kanada-entsperren','/ar/unlock-canadian-iphone'],
 ['/services/imei-check/blacklist-status','/es/verificar-reporte-robo-imei','/fr-ca/verifier-liste-noire-imei-canada','/pt/consultar-lista-negra-imei','/de/imei-blacklist-pruefung','/ar/imei-blacklist-check'],
 ['/services/unlock/austria','/es/desbloquear-iphone-austria','/fr-ca/deverrouiller-iphone-autriche','/pt/desbloquear-iphone-austria','/de/iphone-entsperren-oesterreich','/ar/unlock-iphone-austria']
]
export const homePaths=['/','/es','/fr-ca','/pt','/de','/ar']

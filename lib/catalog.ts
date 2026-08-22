/**
 * Service catalog, transcribed from the observed BaseIMEI listing
 * (docs/reference/baseimei-backend-flow.md, appendix A). Ids are kept as
 * observed — they are not contiguous, because services get opened and
 * retired over time.
 *
 * cost_price is deliberately absent: provider cost was never exposed to
 * the client, and inventing one would put a fake margin in the ledger.
 */

export type IdentifierType = 'imei' | 'serial' | 'both'

export type CatalogEntry = {
  id: number
  name: string
  sellPriceUsd: number
  identifierType: IdentifierType
}

export const CATALOG: CatalogEntry[] = [
  { id: 62, name: 'Apple BASIC INFO (PRO) - new', sellPriceUsd: 0.07, identifierType: 'imei' },
  { id: 27, name: 'Apple Carrier Check (S2)', sellPriceUsd: 0.07, identifierType: 'imei' },
  { id: 55, name: 'Apple Demo Unit Device Info', sellPriceUsd: 0.24, identifierType: 'imei' },
  { id: 31, name: 'APPLE FULL INFO [+Carrier] A', sellPriceUsd: 0.12, identifierType: 'imei' },
  { id: 24, name: 'Apple FULL INFO [+Carrier] B (+MDM)', sellPriceUsd: 0.24, identifierType: 'imei' },
  { id: 10, name: 'Apple FULL INFO [No Carrier]', sellPriceUsd: 0.1, identifierType: 'imei' },
  { id: 48, name: 'Apple SERIAL Info (model, size, color)', sellPriceUsd: 0.04, identifierType: 'serial' },
  { id: 25, name: 'Apple SimLock Check', sellPriceUsd: 0.05, identifierType: 'imei' },
  { id: 13, name: 'Apple Warranty + Activation - PRO [IMEI/SN]', sellPriceUsd: 0.05, identifierType: 'both' },
  { id: 35, name: 'Apple Warranty + Activation [IMEI/SN]', sellPriceUsd: 0.04, identifierType: 'both' },
  { id: 15, name: 'Blacklist Pro Check (GSMA)', sellPriceUsd: 0.1, identifierType: 'imei' },
  { id: 14, name: 'Blacklist Status (GSMA)', sellPriceUsd: 0.05, identifierType: 'imei' },
  { id: 50, name: 'Blacklist Status - cheap', sellPriceUsd: 0.04, identifierType: 'imei' },
  { id: 37, name: 'Find My iPhone [FMI] (ON/OFF)', sellPriceUsd: 0.04, identifierType: 'imei' },
  { id: 51, name: 'Google Pixel Info', sellPriceUsd: 0.22, identifierType: 'imei' },
  { id: 36, name: 'GSX Next Tether + iOS (GSX Carrier)', sellPriceUsd: 0.7, identifierType: 'imei' },
  { id: 52, name: 'Honor Info', sellPriceUsd: 0.08, identifierType: 'imei' },
  { id: 22, name: 'Huawei IMEI Info', sellPriceUsd: 0.1, identifierType: 'imei' },
  { id: 11, name: 'iCloud Clean/Lost Check', sellPriceUsd: 0.05, identifierType: 'imei' },
  { id: 23, name: 'iMac FMI Status On/Off', sellPriceUsd: 0.4, identifierType: 'serial' },
  { id: 38, name: 'IMEI to Brand/Model/Name', sellPriceUsd: 0.04, identifierType: 'imei' },
  { id: 42, name: 'IMEI to Model [all brands][IMEI/SN]', sellPriceUsd: 0.04, identifierType: 'both' },
  { id: 20, name: 'IMEI to SN (Full Convertor)', sellPriceUsd: 0.05, identifierType: 'imei' },
  { id: 47, name: 'LG IMEI INFO', sellPriceUsd: 0.08, identifierType: 'imei' },
  { id: 32, name: 'MDM STATUS ON/OFF + FMIP + MODEL', sellPriceUsd: 0.41, identifierType: 'imei' },
  { id: 19, name: 'Model + Color + Storage + FMI', sellPriceUsd: 0.05, identifierType: 'imei' },
  { id: 49, name: 'Model Description (Any Apple SN/IMEI)', sellPriceUsd: 0.05, identifierType: 'both' },
  { id: 28, name: 'ONEPLUS IMEI INFO', sellPriceUsd: 0.07, identifierType: 'imei' },
  { id: 53, name: 'Realme Info', sellPriceUsd: 0.07, identifierType: 'imei' },
  { id: 30, name: 'Replaced Status (Original Device)', sellPriceUsd: 0.04, identifierType: 'imei' },
  { id: 29, name: 'Replacement Status (Active Device)', sellPriceUsd: 0.04, identifierType: 'imei' },
  { id: 66, name: 'Samsung Info + KNOX GUARD (imei only)(S1)', sellPriceUsd: 0.14, identifierType: 'imei' },
  { id: 57, name: 'Samsung Info (S1) (IMEI)', sellPriceUsd: 0.08, identifierType: 'imei' },
  { id: 45, name: 'Samsung Info (S1) + Blacklist', sellPriceUsd: 0.09, identifierType: 'imei' },
  { id: 17, name: 'SOLD BY + GSX Apple', sellPriceUsd: 1.49, identifierType: 'imei' },
  { id: 41, name: 'T-mobile (ESN) PRO Check', sellPriceUsd: 0.07, identifierType: 'imei' },
  { id: 43, name: 'Verizon (ESN) Clean/Lost Status', sellPriceUsd: 0.07, identifierType: 'imei' },
  { id: 44, name: 'XIAOMI MI LOCK & INFO', sellPriceUsd: 0.08, identifierType: 'imei' },
]

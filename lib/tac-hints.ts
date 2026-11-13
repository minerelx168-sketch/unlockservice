/**
 * Offline TAC (first eight IMEI digits) hints. Deliberately tiny: a TAC is
 * listed only when it is already a verified reference elsewhere in this
 * codebase, so a hint is never a guess. Everything else is reported as a
 * generic device family, which is what the checksum alone can support.
 */
export const KNOWN_TACS: Readonly<Record<string, string>> = {
  '35838974': 'iPhone XR',
  '35782225': 'iPhone XR',
  '35739909': 'iPhone XR',
}

export function tacHint(imei: string): string | null {
  return /^\d{15}$/.test(imei) ? KNOWN_TACS[imei.slice(0, 8)] ?? null : null
}

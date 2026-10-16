/**
 * Turns provider "Key: Value" text into a report a buyer can read.
 *
 * The colour of a row is decided by the label AND the value. "Yes" is
 * good news under "Under Warranty" and bad news under "Blacklisted"; the
 * first version of this card coloured every Yes amber and every No green,
 * which told a buyer that "Lost or Stolen: Yes" was a caution and "Under
 * Warranty: No" was fine. Labels this file does not recognise get no
 * colour at all rather than a guess.
 *
 * Pure and framework-free so it can be tested without React.
 */

export type Tone = 'good' | 'warn' | 'bad' | null

export type ReportRow = { label: string; value: string; tone: Tone }

export type ParsedReport = {
  /** Every row, in the order the provider wrote them. */
  rows: ReportRow[]
  /** Toned rows: the conditions a buyer is checking for. */
  critical: ReportRow[]
  /** Who the device is: identifiers, model, colour, capacity. */
  identity: ReportRow[]
  /** Everything else, including unlabelled lines. */
  details: ReportRow[]
}

/* A "yes" under these labels is a problem. Blocking ones go red; the ones
   an owner can clear (a lock, Find My) go amber. */
const BLOCKING_LABEL = /\b(black ?list(ed)?|lost|stolen|barred|blocked|financ|loan|unpaid|outstanding|fraud)/i
const CAUTION_LABEL =
  /\b(fmi|find my|activation ?lock|icloud|mdm|sim ?lock|carrier ?lock|network ?lock|lock status|locked|refurbish|replaced|replacement|demo|knox|frp|google ?lock|loaner)/i
/* A "yes" under these labels is good news. */
const POSITIVE_LABEL = /\b(warranty|applecare|coverage|activated|activation status|activation date|purchase date|valid|genuine|original|eligible)/i
const IDENTITY_LABEL =
  /\b(imei|meid|serial|model|brand|manufacturer|description|capacity|storage|colou?r|product|device|part number|region|country|carrier name|sold by|network name)\b/i

const YES = new Set(['yes', 'on', 'true', 'active', 'enabled', 'present', 'locked', 'in blacklist', 'blacklisted', 'reported', 'lost', 'stolen', 'barred', 'blocked', 'lost or stolen'])
const NO = new Set(['no', 'off', 'false', 'none', 'clean', 'not found', 'not reported', 'out of blacklist', 'not blacklisted', 'unlocked', 'not locked', 'inactive', 'disabled', 'not present', 'never'])
const ALWAYS_BAD = new Set(['blacklisted', 'in blacklist', 'lost', 'stolen', 'lost or stolen', 'barred', 'blocked', 'reported lost', 'reported stolen', 'fraud'])
const ALWAYS_WARN = new Set(['unknown', 'expired', 'pending', 'n/a', 'not available', 'error'])

function normalise(value: string) {
  return value.trim().toLocaleLowerCase('en').replace(/[.!]+$/, '').replace(/\s+/g, ' ')
}

export function toneFor(label: string, value: string): Tone {
  const v = normalise(value)
  if (!v) return null
  if (ALWAYS_BAD.has(v)) return 'bad'
  if (ALWAYS_WARN.has(v)) return 'warn'

  const yes = YES.has(v)
  const no = NO.has(v)

  if (BLOCKING_LABEL.test(label)) {
    if (yes) return 'bad'
    if (no) return 'good'
    return null
  }
  if (CAUTION_LABEL.test(label)) {
    if (yes) return 'warn'
    if (no) return 'good'
    return null
  }
  if (POSITIVE_LABEL.test(label)) {
    if (yes || v === 'valid' || v === 'in warranty' || v === 'covered') return 'good'
    if (no || v === 'out of warranty' || v === 'not covered') return 'warn'
    return null
  }

  /* No label knowledge: only values that mean the same thing everywhere. */
  if (v === 'clean' || v === 'unlocked' || v === 'valid') return 'good'
  if (v === 'locked') return 'warn'
  return null
}

/**
 * Returns null when the text is not a report — an unlock code, a sentence
 * from the supplier, a bare error — so the caller shows it verbatim.
 */
export function parseReport(text: string): ParsedReport | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return null

  const rows: ReportRow[] = []
  let matched = 0
  for (const line of lines) {
    const split = line.match(/^([^:]{1,48}):\s*(.+)$/)
    if (split) {
      matched += 1
      const label = split[1].trim()
      const value = split[2].trim()
      rows.push({ label, value, tone: toneFor(label, value) })
    } else {
      rows.push({ label: '', value: line, tone: null })
    }
  }
  // Mostly labelled lines, or it is not a report — codes and prose stay verbatim.
  if (matched < Math.max(2, Math.ceil(lines.length * 0.6))) return null

  const critical = rows.filter((row) => row.tone !== null && row.label)
  const identity = rows.filter((row) => row.tone === null && row.label && IDENTITY_LABEL.test(row.label))
  const details = rows.filter((row) => !critical.includes(row) && !identity.includes(row))
  return { rows, critical, identity, details }
}

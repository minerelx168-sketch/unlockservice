import type { IconName } from '@/components/icons'
import { parseReport, type Tone } from './report-card-parse'

/**
 * The rows a landing-page sample card shows. A card has room for six, so
 * this picks the ones that make the point: what the phone is, then every
 * row that carries a verdict, then the rest in the order the provider
 * wrote them. Pure, so the choice is tested rather than eyeballed.
 */

export type SampleRow = { label: string; value: string; tone: Tone; icon: IconName }

const ICON_RULES: Array<[RegExp, IconName]> = [
  [/warranty|coverage|applecare|support|registered|valid/i, 'shieldCheck'],
  [/black ?list|lost|stolen|fraud|barred|esn|\bstatus\b/i, 'shield'],
  [/sim ?lock|carrier|network|policy|\block|icloud|find my|fmi|mdm|knox|frp/i, 'lock'],
  [/model|device|description|part number|capacity|storage|colou?r/i, 'device'],
  [/manufacturer|brand/i, 'grid'],
  [/country|region|purchased in|sold|ship|\bby\b/i, 'globe'],
  [/date|\bon\b|until|expir|production|activated/i, 'clock'],
]

export function iconForLabel(label: string): IconName {
  for (const [pattern, icon] of ICON_RULES) if (pattern.test(label)) return icon
  return 'file'
}

/** One word for the badge beside a toned value. */
export function badgeFor(tone: Tone): string | null {
  if (tone === 'good') return 'Clear'
  if (tone === 'warn') return 'Attention'
  if (tone === 'bad') return 'Flagged'
  return null
}

export function sampleRows(text: string, max = 6): { rows: SampleRow[]; total: number } | null {
  const parsed = parseReport(text)
  if (!parsed) return null
  /* Redacted identifiers are not worth a row in a sample. */
  const labelled = parsed.rows.filter((row) => row.label && !/^\[redacted\]$/i.test(row.value))
  if (!labelled.length) return null

  const first = labelled.find((row) => row.tone === null && /model|device/i.test(row.label))
  const ordered: typeof labelled = []
  for (const row of [first, ...parsed.critical, ...labelled]) {
    if (row && labelled.includes(row) && !ordered.includes(row)) ordered.push(row)
  }
  return {
    rows: ordered.slice(0, max).map((row) => ({ label: row.label, value: row.value, tone: row.tone, icon: iconForLabel(row.label) })),
    total: labelled.length,
  }
}

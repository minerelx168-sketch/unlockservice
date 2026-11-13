import Link from 'next/link'
import { getServiceOutputExample } from '@/lib/service-output-examples'

// Use exactly the first Lite and Pro examples printed by CarrierGuide ("How to
// read a carrier report"). Only aggregate field presence and enumerated states:
// no raw identifiers, private orders, inferred missing values or paid API calls.
const topics = {
  'what-an-imei-check-tells-you': 'fields',
  'blacklisted-iphone-unlock-carrier-lock-difference': 'blocklist',
  'iphone-locked-to-owner-legitimate-fixes': 'findMy',
} as const

function sampleFields(report: string) {
  const result = new Map<string, string>()
  for (const line of report.split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon > 0) result.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim().toLowerCase())
  }
  return result
}

export function ArticleObservation({slug}: {slug:string}) {
  if (!Object.hasOwn(topics, slug)) return null
  const samples = ['APPLE_CARRIER_LITE','APPLE_CARRIER_PRO'].flatMap(code => {
    const text = getServiceOutputExample(code)?.variants[0]?.output
    return text ? [sampleFields(text)] : []
  })
  if (samples.length !== 2) return null
  const kind = topics[slug as keyof typeof topics]
  let report: string
  if (kind === 'fields') {
    const lock = samples.filter(s=>s.has('sim-lock')).length
    const block = samples.filter(s=>s.has('blacklist status')).length
    report = `We compared the field names in our two published examples. ${lock} of 2 include a SIM-Lock field; ${block} of 2 include a Blacklist Status field. An omitted field is not a clean result.`
  } else if (kind === 'blocklist') {
    const matches = samples.filter(s=>s.get('sim-lock')==='unlocked' && s.get('blacklist status')==='blacklisted').length
    if (!matches) return null
    report = `In ${matches} of our 2 published examples, the same report reads “Unlocked” under SIM-Lock and “Blacklisted” under Blacklist Status. Read both fields before deciding whether a phone can use another network.`
  } else {
    const matches = samples.filter(s=>s.get('sim-lock')==='unlocked' && s.get('find my iphone')==='on').length
    if (!matches) return null
    report = `In ${matches} of our 2 published examples, SIM-Lock reads “Unlocked” while Find My iPhone reads “ON.” A carrier unlock does not show that the previous owner removed the phone from their Apple Account.`
  }
  return <aside className="article-note" aria-label="Catalog evidence">
    <div><strong>What our sample reports show</strong><p>{report}</p>
      <p><Link href="/services/imei-check/apple-carrier-lock-status">Compare the Lite and Pro sample outputs</Link> under “How to read a carrier report.” We counted one example per report type; these are not customer orders or estimates of how common a result is.</p>
    </div>
  </aside>
}

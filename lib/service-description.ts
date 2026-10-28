export type ServiceDescriptionBlock =
  | { kind: 'text'; text: string }
  | { kind: 'table'; headings: string[]; rows: string[][] }

const APPLE_FEATURES = ['SIM-Lock', 'Carrier Locked', 'Part Number', 'iCloud Status', 'Chimaera Status', 'MDM Status']
const TABLE_HEADERS = [
  ['Type', 'Component Description', 'Issue Description'],
  ['MPN', 'Description', 'Type'],
]

/** Recover only known, complete provider tables. Unknown formats remain verbatim. */
function readTable(text: string): ServiceDescriptionBlock | null {
  const cells = text.split('|').map(cell => cell.trim())
  if (cells.at(-1) === '') cells.pop()
  if (cells[0] === '') cells.shift()
  const apple = APPLE_FEATURES.every((heading, index) => cells[index] === heading)
  const headings = apple ? ['Report', ...APPLE_FEATURES] : TABLE_HEADERS.find(header => header.every((heading, index) => cells[index] === heading))
  if (!headings) return null
  const body = cells.slice(apple ? APPLE_FEATURES.length : headings.length)
  if (!body.length || body.length % headings.length !== 0) return null
  const rows: string[][] = []
  for (let index = 0; index < body.length; index += headings.length) rows.push(body.slice(index, index + headings.length))
  if (apple && rows.some(row => !row[0] || row.slice(1).some(value => !/^(Yes|No)$/.test(value)))) return null
  return { kind: 'table', headings, rows }
}

export function serviceDescriptionBlocks(value: string): ServiceDescriptionBlock[] {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ServiceDescriptionBlock[] = []
  let index = 0
  while (index < lines.length) {
    const tableLike = lines[index].trimEnd().endsWith('|')
    const start = index++
    while (index < lines.length && lines[index].trimEnd().endsWith('|') === tableLike) index++
    const text = lines.slice(start, index).join('\n').trim()
    if (!text) continue
    blocks.push((tableLike && readTable(text)) || { kind: 'text', text })
  }
  return blocks
}

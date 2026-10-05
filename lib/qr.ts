import qrcode from 'qrcode-generator'

/**
 * A QR code as one SVG path, drawn on the server. The page makes no request
 * for it, and the colours come from tokens in CSS rather than from here —
 * the path only says where the dark modules are.
 */
export function qrPath(text: string): { size: number; path: string } {
  const code = qrcode(0, 'M')
  code.addData(text)
  code.make()
  const count = code.getModuleCount()
  const quiet = 2
  const parts: string[] = []
  for (let row = 0; row < count; row += 1) {
    let column = 0
    while (column < count) {
      if (!code.isDark(row, column)) {
        column += 1
        continue
      }
      const start = column
      while (column < count && code.isDark(row, column)) column += 1
      parts.push(`M${start + quiet} ${row + quiet}h${column - start}v1h-${column - start}z`)
    }
  }
  return { size: count + quiet * 2, path: parts.join('') }
}

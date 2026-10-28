import type { SimpleIcon } from 'simple-icons'
import { siApplepay, siBitcoin, siGooglepay, siMastercard, siTether, siVisa } from 'simple-icons'

/**
 * Payment acceptance marks, the way the reference shows them: each method
 * as its own small badge with the real mark, not a text pill. The marks
 * come from the simple-icons data set rather than being drawn here, and
 * each badge names its method for screen readers.
 */
const MARKS: Record<string, SimpleIcon> = {
  visa: siVisa,
  mastercard: siMastercard,
  googlepay: siGooglepay,
  applepay: siApplepay,
  bitcoin: siBitcoin,
  usdt: siTether,
}

export function PaymentMark({ method, label }: { method: string; label?: string }) {
  const icon = MARKS[method]
  if (!icon) return null
  return (
    <span className="pay-mark" title={label ?? icon.title}>
      <svg viewBox="0 0 24 24" role="img" aria-label={label ?? icon.title} style={{ fill: `#${icon.hex}` }}>
        <path d={icon.path} />
      </svg>
      {label ? <b>{label}</b> : null}
    </span>
  )
}

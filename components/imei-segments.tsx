/**
 * Fifteen short bars under an IMEI field, one per digit typed. It answers
 * "how many more?" at a glance without a number the eye has to parse, and
 * turns green as one piece when the checksum passes.
 */
export function ImeiSegments({ count, valid }: { count: number; valid: boolean }) {
  const filled = Math.min(15, Math.max(0, count))
  return (
    <span className="imei-segments" data-valid={valid ? 'true' : undefined} aria-hidden="true">
      {Array.from({ length: 15 }, (_, index) => (
        <i key={index} data-on={index < filled ? 'true' : undefined} />
      ))}
    </span>
  )
}

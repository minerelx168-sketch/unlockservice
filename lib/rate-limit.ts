import { createHash } from 'node:crypto'
import { db } from './db'

/** Small SQLite-backed attempt window shared by login and OTP flows. */

function subjectHash(subject: string): string {
  return createHash('sha256').update(subject.trim().toLowerCase()).digest('hex')
}

export function consumeAttempt(
  bucket: string,
  subject: string,
  maxAttempts: number,
  windowSeconds: number,
): boolean {
  const hash = subjectHash(subject)
  const now = new Date()

  return db().transaction(() => {
    const row = db()
      .prepare('SELECT window_start, attempts FROM auth_rate_limits WHERE bucket = ? AND subject_hash = ?')
      .get(bucket, hash) as { window_start: string; attempts: number } | undefined

    if (!row || now.getTime() - new Date(row.window_start).getTime() >= windowSeconds * 1000) {
      db()
        .prepare(
          `INSERT INTO auth_rate_limits (bucket, subject_hash, window_start, attempts)
           VALUES (?, ?, ?, 1)
           ON CONFLICT(bucket, subject_hash)
           DO UPDATE SET window_start = excluded.window_start, attempts = 1`,
        )
        .run(bucket, hash, now.toISOString())
      return true
    }

    if (row.attempts >= maxAttempts) return false
    db()
      .prepare('UPDATE auth_rate_limits SET attempts = attempts + 1 WHERE bucket = ? AND subject_hash = ?')
      .run(bucket, hash)
    return true
  })()
}

export function clearAttempts(bucket: string, subject: string) {
  db()
    .prepare('DELETE FROM auth_rate_limits WHERE bucket = ? AND subject_hash = ?')
    .run(bucket, subjectHash(subject))
}

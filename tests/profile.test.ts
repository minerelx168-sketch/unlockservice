import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-profile-'))
process.env.IUNLOCKMOBILE_DB = join(workDir, 'profile.db')
delete process.env.RESEND_API_KEY
let database: typeof import('../lib/db')
let auth: typeof import('../lib/auth')
let security: typeof import('../lib/account-security')
let profile: typeof import('../lib/profile')
const password = 'correct horse battery'
let counter = 0
function newUser() {
  counter += 1
  const user = auth.register(`person${counter}`, `person${counter}@example.test`, password)
  database.db().prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(user.id)
  return user
}
function pending(userId: number, mail: string, code = '482913') {
  database.db().prepare('UPDATE users SET pending_email = ? WHERE id = ?').run(mail, userId)
  database.db().prepare("INSERT INTO email_verifications (user_id, code_hash, purpose, expires_at) VALUES (?, ?, 'email_change', ?)")
    .run(userId, createHash('sha256').update(code).digest('hex'), new Date(Date.now() + 600_000).toISOString())
}
before(async () => {
  database = await import('../lib/db'); auth = await import('../lib/auth')
  security = await import('../lib/account-security'); profile = await import('../lib/profile'); database.db()
})
after(() => { rmSync(workDir, { recursive: true, force: true }) })

test('the migration adds the profile columns without touching existing rows', () => {
  const columns = database.db().prepare('PRAGMA table_info(users)').all() as Array<{ name: string; dflt_value: string | null }>
  assert.equal(columns.find((column) => column.name === 'avatar_style')?.dflt_value, "'violet'")
  assert.ok(columns.some((column) => column.name === 'pending_email'))
  assert.deepEqual(profile.getAccountProfile(newUser().id), { avatarStyle: 'violet', pendingEmail: null })
})
test('avatar styles are a closed list', () => {
  const user = newUser()
  assert.equal(profile.setAvatarStyle(user.id, 'teal'), 'teal')
  assert.equal(profile.getAccountProfile(user.id).avatarStyle, 'teal')
  assert.throws(() => profile.setAvatarStyle(user.id, 'url(javascript:alert(1))'), /listed avatar styles/)
  assert.equal(profile.getAccountProfile(user.id).avatarStyle, 'teal')
  assert.equal(profile.initialsFor('mine.relx'), 'MR'); assert.equal(profile.initialsFor('boss'), 'BO')
})
test('a password change needs the current password, and signs the other devices out', () => {
  const user = newUser(), keep = auth.createSession(user.id), other = auth.createSession(user.id)
  assert.throws(() => security.changePassword(user.id, 'wrong one', 'a brand new password', keep.id), /current password/)
  assert.throws(() => security.changePassword(user.id, password, 'short', keep.id), /at least 8/)
  assert.throws(() => security.changePassword(user.id, password, password, keep.id), /not used here before/)
  security.changePassword(user.id, password, 'a brand new password', keep.id)
  const row = database.db().prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string }
  assert.ok(auth.verifyPassword('a brand new password', row.password_hash))
  assert.ok(!auth.verifyPassword(password, row.password_hash))
  const sessions = database.db().prepare('SELECT id FROM sessions WHERE user_id = ?').all(user.id) as Array<{ id: string }>
  assert.deepEqual(sessions.map((session) => session.id), [keep.id]); assert.notEqual(other.id, keep.id)
})
test('email changes require delivery, the new-inbox code, the current password and an owned live session', async () => {
  const user = newUser(), taken = newUser(), keep = auth.createSession(user.id), other = auth.createSession(user.id)
  await assert.rejects(() => security.startEmailChange(user.id, 'new@example.test', password), /Email delivery is not configured/)
  pending(user.id, 'new@example.test')
  assert.throws(() => security.confirmEmailChange(user.id, '12345', password, keep.id), /6 digits/)
  assert.throws(() => security.confirmEmailChange(user.id, '000000', password, keep.id), /Incorrect verification code/)
  assert.throws(() => security.confirmEmailChange(user.id, '482913', '', keep.id), /current password/)
  assert.throws(() => security.confirmEmailChange(user.id, '482913', 'wrong', keep.id), /current password/)
  assert.equal(auth.getUser(user.id)!.email, user.email)
  const updated = security.confirmEmailChange(user.id, '482913', password, keep.id)
  assert.equal(updated.email, 'new@example.test'); assert.equal(profile.getAccountProfile(user.id).pendingEmail, null)
  assert.ok(database.db().prepare('SELECT 1 FROM sessions WHERE id = ?').get(keep.id))
  assert.equal(database.db().prepare('SELECT 1 FROM sessions WHERE id = ?').get(other.id), undefined)
  assert.throws(() => security.confirmEmailChange(user.id, '482913', password, keep.id), /No email change is waiting/)
  pending(user.id, taken.email)
  assert.throws(() => security.confirmEmailChange(user.id, '482913', password, keep.id), /cannot be used/)
  assert.equal(auth.getUser(user.id)!.email, 'new@example.test')
  security.cancelEmailChange(user.id); assert.equal(profile.getAccountProfile(user.id).pendingEmail, null)
})
test('email start refuses missing or incorrect password before writing state or attempting delivery', async () => {
  const user = newUser(), originalFetch = globalThis.fetch
  process.env.RESEND_API_KEY = 'synthetic-only'; process.env.IUNLOCKMOBILE_EMAIL_FROM = 'no-reply@example.test'
  let calls = 0
  globalThis.fetch = async () => { calls += 1; return new Response('{}', { status: 200 }) }
  try {
    for (const current of ['', 'incorrect']) await assert.rejects(() => security.startEmailChange(user.id, 'target@example.test', current), /current password/)
    assert.equal(calls, 0); assert.equal(profile.getAccountProfile(user.id).pendingEmail, null)
    const rows = database.db().prepare("SELECT COUNT(*) n FROM email_verifications WHERE user_id=? AND purpose='email_change'").get(user.id) as { n: number }
    assert.equal(rows.n, 0)
    await security.startEmailChange(user.id, 'target@example.test', password)
    assert.equal(calls, 1); assert.equal(profile.getAccountProfile(user.id).pendingEmail, 'target@example.test')
  } finally { globalThis.fetch = originalFetch; delete process.env.RESEND_API_KEY; delete process.env.IUNLOCKMOBILE_EMAIL_FROM }
})
test('casefold collision with a legacy uppercase email is blocked before sending and before final update', async () => {
  const user = newUser(), taken = newUser(), keep = auth.createSession(user.id)
  database.db().prepare('UPDATE users SET email = upper(email) WHERE id = ?').run(taken.id)
  process.env.RESEND_API_KEY = 'synthetic-only'; process.env.IUNLOCKMOBILE_EMAIL_FROM = 'no-reply@example.test'
  try { await assert.rejects(() => security.startEmailChange(user.id, taken.email, password), /cannot be used/) }
  finally { delete process.env.RESEND_API_KEY; delete process.env.IUNLOCKMOBILE_EMAIL_FROM }
  pending(user.id, taken.email)
  assert.throws(() => security.confirmEmailChange(user.id, '482913', password, keep.id), /cannot be used/)
  assert.equal(auth.getUser(user.id)!.email, user.email)
})
test('password changes cancel pending email changes and consume the outstanding email OTP', () => {
  const user = newUser(), keep = auth.createSession(user.id)
  pending(user.id, 'waiting@example.test')
  security.changePassword(user.id, password, 'a new password to protect recovery', keep.id)
  assert.equal(profile.getAccountProfile(user.id).pendingEmail, null)
  const active = database.db().prepare("SELECT COUNT(*) n FROM email_verifications WHERE user_id=? AND purpose='email_change' AND consumed_at IS NULL").get(user.id) as { n: number }
  assert.equal(active.n, 0)
})
test('neither password nor email change can retain a different owner session', () => {
  const user = newUser(), stranger = newUser(), foreign = auth.createSession(stranger.id)
  pending(user.id, 'foreign-session@example.test')
  assert.throws(() => security.confirmEmailChange(user.id, '482913', password, foreign.id), /session has expired/)
  assert.throws(() => security.changePassword(user.id, password, 'a very different password', foreign.id), /session has expired/)
  const row = database.db().prepare('SELECT password_hash FROM users WHERE id=?').get(user.id) as { password_hash: string }
  assert.ok(auth.verifyPassword(password, row.password_hash)); assert.equal(auth.getUser(user.id)!.email, user.email)
})

test('the database enforces email casefold uniqueness for inserts and updates from any caller', () => {
  const one = newUser(), two = newUser()
  const index = database.db().prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='users_email_casefold_unique'").get() as { sql: string } | undefined
  assert.ok(index); assert.match(index.sql, /UNIQUE INDEX.*users\(lower\(email\)\)/)
  assert.throws(() => database.db().prepare('INSERT INTO users(username,email,password_hash) VALUES (?,?,?)').run('casefold-external', one.email.toUpperCase(), 'synthetic'), /UNIQUE constraint/)
  assert.throws(() => database.db().prepare('UPDATE users SET email=? WHERE id=?').run(one.email.toUpperCase(), two.id), /UNIQUE constraint/)
  database.db().prepare('UPDATE users SET email=upper(email) WHERE id=?').run(one.id)
  assert.throws(() => auth.register('casefold-registration', one.email, password), /email cannot be used/)
})

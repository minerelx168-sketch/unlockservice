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

let counter = 0
function newUser() {
  counter += 1
  const user = auth.register(`person${counter}`, `person${counter}@example.test`, 'correct horse battery')
  database.db().prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(user.id)
  return user
}

before(async () => {
  database = await import('../lib/db')
  auth = await import('../lib/auth')
  security = await import('../lib/account-security')
  profile = await import('../lib/profile')
  database.db()
})

after(() => {
  rmSync(workDir, { recursive: true, force: true })
})

test('the migration adds the profile columns without touching existing rows', () => {
  const columns = (database.db().prepare('PRAGMA table_info(users)').all() as Array<{ name: string; dflt_value: string | null }>)
  const avatar = columns.find((column) => column.name === 'avatar_style')
  assert.ok(avatar, 'avatar_style column')
  assert.equal(avatar.dflt_value, "'violet'")
  assert.ok(columns.some((column) => column.name === 'pending_email'), 'pending_email column')
  const user = newUser()
  assert.deepEqual(profile.getAccountProfile(user.id), { avatarStyle: 'violet', pendingEmail: null })
})

test('avatar styles are a closed list', () => {
  const user = newUser()
  assert.equal(profile.setAvatarStyle(user.id, 'teal'), 'teal')
  assert.equal(profile.getAccountProfile(user.id).avatarStyle, 'teal')
  assert.throws(() => profile.setAvatarStyle(user.id, 'url(javascript:alert(1))'), /listed avatar styles/)
  assert.equal(profile.getAccountProfile(user.id).avatarStyle, 'teal')
  assert.equal(profile.initialsFor('mine.relx'), 'MR')
  assert.equal(profile.initialsFor('boss'), 'BO')
})

test('a password change needs the current password, and signs the other devices out', () => {
  const user = newUser()
  const keep = auth.createSession(user.id)
  const other = auth.createSession(user.id)

  assert.throws(() => security.changePassword(user.id, 'wrong one', 'a brand new password', keep.id), /current password/)
  assert.throws(() => security.changePassword(user.id, 'correct horse battery', 'short', keep.id), /at least 8/)
  assert.throws(() => security.changePassword(user.id, 'correct horse battery', 'correct horse battery', keep.id), /not used here before/)

  security.changePassword(user.id, 'correct horse battery', 'a brand new password', keep.id)
  const row = database.db().prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string }
  assert.ok(auth.verifyPassword('a brand new password', row.password_hash))
  assert.ok(!auth.verifyPassword('correct horse battery', row.password_hash))
  const sessions = database.db().prepare('SELECT id FROM sessions WHERE user_id = ?').all(user.id) as Array<{ id: string }>
  assert.deepEqual(sessions.map((session) => session.id), [keep.id])
  assert.notEqual(other.id, keep.id)
})

test('an email change starts only when mail can be sent, and finishes only with the code from the new inbox', () => {
  const user = newUser()
  const taken = newUser()
  assert.rejects(() => security.startEmailChange(user.id, 'new@example.test'), /Email delivery is not configured/)

  /* Stand in for the send step: the pending address and a hashed code. */
  const code = '482913'
  database.db().prepare('UPDATE users SET pending_email = ? WHERE id = ?').run('new@example.test', user.id)
  database.db()
    .prepare("INSERT INTO email_verifications (user_id, code_hash, purpose, expires_at) VALUES (?, ?, 'email_change', ?)")
    .run(user.id, createHash('sha256').update(code).digest('hex'), new Date(Date.now() + 600_000).toISOString())

  assert.throws(() => security.confirmEmailChange(user.id, '12345'), /6 digits/)
  assert.throws(() => security.confirmEmailChange(user.id, '000000'), /Incorrect verification code/)
  const updated = security.confirmEmailChange(user.id, code)
  assert.equal(updated.email, 'new@example.test')
  assert.equal(profile.getAccountProfile(user.id).pendingEmail, null)
  assert.throws(() => security.confirmEmailChange(user.id, code), /No email change is waiting/)

  /* The second step cannot land on an address somebody else owns. */
  database.db().prepare('UPDATE users SET pending_email = ? WHERE id = ?').run(taken.email, user.id)
  database.db()
    .prepare("INSERT INTO email_verifications (user_id, code_hash, purpose, expires_at) VALUES (?, ?, 'email_change', ?)")
    .run(user.id, createHash('sha256').update(code).digest('hex'), new Date(Date.now() + 600_000).toISOString())
  assert.throws(() => security.confirmEmailChange(user.id, code), /cannot be used/)
  assert.equal(auth.getUser(user.id)!.email, 'new@example.test')

  security.cancelEmailChange(user.id)
  assert.equal(profile.getAccountProfile(user.id).pendingEmail, null)
})
